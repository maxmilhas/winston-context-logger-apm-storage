[![Actions Status](https://github.com/maxmilhas/winston-context-logger-async-local-storage/workflows/build/badge.svg)](https://github.com/maxmilhas/winston-context-logger-async-local-storage/actions)
[![Actions Status](https://github.com/maxmilhas/winston-context-logger-async-local-storage/workflows/test/badge.svg)](https://github.com/maxmilhas/winston-context-logger-async-local-storage/actions)
[![Actions Status](https://github.com/maxmilhas/winston-context-logger-async-local-storage/workflows/lint/badge.svg)](https://github.com/maxmilhas/winston-context-logger-async-local-storage/actions)
[![Test Coverage](https://api.codeclimate.com/v1/badges/65e41e3018643f28168e/test_coverage)](https://codeclimate.com/github/maxmilhas/winston-context-logger-async-local-storage/test_coverage)
[![Maintainability](https://api.codeclimate.com/v1/badges/65e41e3018643f28168e/maintainability)](https://codeclimate.com/github/maxmilhas/winston-context-logger-async-local-storage/maintainability)
[![Packages](https://david-dm.org/maxmilhas/winston-context-logger-async-local-storage.svg)](https://david-dm.org/maxmilhas/winston-context-logger-async-local-storage)
[![npm version](https://badge.fury.io/js/%40maxmilhas%2Fwinston-context-logger-async-local-storage.svg)](https://badge.fury.io/js/%40maxmilhas%2Fwinston-context-logger-async-local-storage)

Context provider for winston-context-logger implemented by using a elastic-apm-nodejs transaction.
With this context provider, it is possible to have a fully contextualized logger where all the context is tied to apm transactions, and the correlationid generated will be the traceparent, contributing even to a trace distribution over a micro service scenario done completely by the apm api.

## How to Install

```
npm i winston-context-logger-apm-storage
```

## How to use it

Just pass it to ContextLogger during instantiation and you're done.

```ts
new ContextLogger(logger, apmContextProvider);
```

You can also create sub custom contexts that will inherit all the metadata from the parents:

```ts
await apmContextProvider.subContext('my sub routine', async () => {
  // Do something here
  logger.addMeta('newOne', 'new metadata');
  logger.info('Log with all the inherited metadata and the newOne');
});
  logger.info('Log without the newOne metadata');
```


## License

Licensed under [MIT](https://en.wikipedia.org/wiki/MIT_License).
