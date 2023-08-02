import { ContextInfoProvider } from 'winston-context-logger';
import apm from 'elastic-apm-node';

const loggerContextSymbol = Symbol('LoggerContext');
const onContextEndSymbol = Symbol('OnContextEnd');
const flushSymbol = Symbol('Flush');
export class RequestContext {
	readonly privateMeta: {
		[key: symbol]: object;
	} = {};

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
	context.privateMeta[onContextEndSymbol] = list;
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
	context.privateMeta[flushSymbol] = flush;
	transaction.end = (...args: Parameters<typeof transaction.end>) => {
		end(...args);
		flush();
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Func = (...args: any[]) => any;
const rootContext = new RequestContext('root', 'root');

export class ApmContextProvider<T extends object>
	implements ContextInfoProvider<T>
{
	currentContext() {
		const transaction = apm.currentTransaction;
		if (!transaction) {
			return rootContext;
		}

		let context = (transaction as unknown as Record<symbol, RequestContext>)[
			loggerContextSymbol
		];
		if (!context) {
			context = new RequestContext(
				transaction.traceparent ?? transaction.ids['trace.id'],
				transaction.name,
			);
			(transaction as unknown as Record<symbol, RequestContext>)[
				loggerContextSymbol
			] = context;
			monkeyPatchOnEnd(transaction, context);
		}

		return context;
	}

	get correlationId() {
		return this.currentContext().correlationId;
	}

	get routine() {
		return this.currentContext().routine;
	}

	getContextInfo() {
		return this.currentContext().privateMeta[loggerContextSymbol];
	}
	setContextInfo(value: object) {
		this.currentContext().privateMeta[loggerContextSymbol] = value;
	}

	onContextEnd(callback: () => void): void {
		(
			this.currentContext().privateMeta[onContextEndSymbol] as
				| Array<() => void>
				| undefined
		)?.push(callback);
	}

	flush() {
		(this.currentContext().privateMeta[flushSymbol] as () => void)();
	}
}

export const apmContextProvider = new ApmContextProvider();
