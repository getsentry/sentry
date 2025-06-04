import {
  getDocsPlatformSDKForPlatform,
  getProfilingDocsForPlatform,
} from 'sentry/utils/profiling/platforms';

describe('getDocsPlatformSDKForPlatform', function () {
  it.each([
    [undefined, null],
    ['android', 'android'],
    ['apple-macos', 'apple-macos'],
    ['apple-ios', 'apple-ios'],
    ['python', 'python'],
    ['python-django', 'python'],
    ['python-flask', 'python'],
    ['python-fastapi', 'python'],
    ['python-starlette', 'python'],
    ['python-sanic', 'python'],
    ['python-celery', 'python'],
    ['python-bottle', 'python'],
    ['python-pylons', 'python'],
    ['python-pyramid', 'python'],
    ['python-tornado', 'python'],
    ['python-rq', 'python'],
    ['python-awslambda', 'python'],
    ['python-azurefunctions', 'python'],
    ['python-gcpfunctions', 'python'],
    ['node', 'node'],
    ['node-awslambda', 'node'],
    ['node-azurefunctions', 'node'],
    ['node-connect', 'node'],
    ['node-express', 'node'],
    ['node-fastify', 'node'],
    ['node-gcpfunctions', 'node'],
    ['node-hapi', 'node'],
    ['node-koa', 'node'],
    ['node-nestjs', 'node'],
  ])('gets docs platform for %s', function (platform, docsPlatform) {
    expect(getDocsPlatformSDKForPlatform(platform)).toEqual(docsPlatform);
  });
});

describe('getProfilingDocsForPlatform', function () {
  it.each([
    ['android', 'https://docs.sentry.io/platforms/android/profiling/'],
    ['apple-macos', 'https://docs.sentry.io/platforms/apple/guides/macos/profiling/'],
    ['apple-ios', 'https://docs.sentry.io/platforms/apple/guides/ios/profiling/'],
    ['python', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['python-django', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['python-flask', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['python-fastapi', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['python-starlette', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['python-sanic', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['python-celery', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['python-bottle', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['python-pylons', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['python-pyramid', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['python-tornado', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['python-rq', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['python-awslambda', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['python-azurefunctions', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['python-gcpfunctions', 'https://docs.sentry.io/platforms/python/profiling/'],
    ['node', 'https://docs.sentry.io/platforms/node/profiling/'],
    ['node-awslambda', 'https://docs.sentry.io/platforms/node/profiling/'],
    ['node-azurefunctions', 'https://docs.sentry.io/platforms/node/profiling/'],
    ['node-connect', 'https://docs.sentry.io/platforms/node/profiling/'],
    ['node-express', 'https://docs.sentry.io/platforms/node/profiling/'],
    ['node-fastify', 'https://docs.sentry.io/platforms/node/profiling/'],
    ['node-gcpfunctions', 'https://docs.sentry.io/platforms/node/profiling/'],
    ['node-hapi', 'https://docs.sentry.io/platforms/node/profiling/'],
    ['node-koa', 'https://docs.sentry.io/platforms/node/profiling/'],
    ['node-nestjs', 'https://docs.sentry.io/platforms/node/profiling/'],
  ])('gets profiling docs for %s', function (platform, docs) {
    expect(getProfilingDocsForPlatform(platform)).toEqual(docs);
  });
});
