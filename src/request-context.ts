import { ContextInfoProvider } from 'winston-context-logger';
import apm from 'elastic-apm-node';
import { AsyncLocalStorage } from 'async_hooks';

const loggerContextSymbol = Symbol('LoggerContext');
const onContextEndSymbol = Symbol('OnContextEnd');
const subStorageSymbol = Symbol('SubStorage');
const flushSymbol = Symbol('Flush');

export class RequestContext {
	readonly privateMeta = new Map<symbol, unknown>();

	[subStorageSymbol]: AsyncLocalStorage<RequestContext> | undefined;

	constructor(
		public readonly correlationId: string,
		public readonly routine: string,
	) {}
}

function monkeyPatchOnEnd(
	transaction: apm.Transaction,
	context: RequestContext,
) {
	const end = transaction.end.bind(transaction);
	let list = [] as Array<(routine?: string) => void>;
	context.privateMeta.set(onContextEndSymbol, list);
	function flush() {
		const current = list;
		list = [];
		current.forEach((callback) => {
			try {
				callback(transaction.name);
			} catch (error) {
				console.error(
					`Error when calling context end callback ${(error as Error).stack}`,
				);
			}
		});
	}
	context.privateMeta.set(flushSymbol, flush);
	transaction.end = (...args: Parameters<typeof transaction.end>) => {
		end(...args);
		flush();
	};
}

function createSubContext(
	current: RequestContext,
	correlationId: string,
	subRoutine: string,
) {
	const context = new RequestContext(correlationId, subRoutine);
	const { privateMeta } = current;
	for (const [key, value] of privateMeta) {
		context.privateMeta.set(key, value);
	}
	return context;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Func = (...args: any[]) => any;
const rootContext = new RequestContext('root', 'root');

export class ApmContextProvider<T extends object>
	implements ContextInfoProvider<T>
{
	/**
	 * @returns the current RequestContext object
	 */
	currentContext() {
		const transaction = apm.currentTransaction;
		let context: RequestContext | undefined;
		if (!transaction) {
			context = rootContext;
		} else {
			context = (transaction as unknown as Record<symbol, RequestContext>)[
				loggerContextSymbol
			];
			if (!context) {
				context = createSubContext(
					rootContext,
					transaction.traceparent ?? transaction.ids['trace.id'],
					transaction.name,
				);
				(transaction as unknown as Record<symbol, RequestContext>)[
					loggerContextSymbol
				] = context;
				monkeyPatchOnEnd(transaction, context);
			}
		}
		const subStorage = context[subStorageSymbol];
		if (subStorage) {
			const subContext = subStorage.getStore();
			if (subContext) {
				context = subContext;
			}
		}

		return context;
	}

	/**
	 * The current correlation Id
	 */
	get correlationId() {
		return this.currentContext().correlationId;
	}

	/**
	 * The current routine
	 */
	get routine() {
		return this.currentContext().routine;
	}

	/**
	 * @returns Returns the logger metadata
	 */
	getContextInfo() {
		return this.currentContext().privateMeta.get(
			loggerContextSymbol,
		) as Partial<T>;
	}
	/**
	 * Sets te current logger metadata;
	 * @param value the logger metadata value
	 */
	setContextInfo(value: object) {
		const context = this.currentContext();
		context.privateMeta.set(loggerContextSymbol, value);
	}

	/**
	 * creates a new sub contexts that will inherits every parent metadata
	 * @param subRoutine
	 */
	async subContext(subRoutine: string, callback: () => unknown) {
		const current = this.currentContext();
		let storage = current[subStorageSymbol];
		if (!storage) {
			storage = new AsyncLocalStorage();
			current[subStorageSymbol] = storage;
		}
		const context = createSubContext(
			current,
			current.correlationId,
			subRoutine,
		);
		await storage.run(context, callback);
	}

	onContextEnd(callback: () => void): void {
		(
			this.currentContext().privateMeta.get(onContextEndSymbol) as
				| Array<() => void>
				| undefined
		)?.push(callback);
	}

	flush() {
		(this.currentContext().privateMeta.get(flushSymbol) as () => void)();
	}
}

export const apmContextProvider = new ApmContextProvider();
