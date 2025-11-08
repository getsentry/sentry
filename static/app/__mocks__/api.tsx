import {Client as MockClient} from './mockApi';

const RealApi = jest.requireActual('sentry/api');
const RealClient = RealApi.Client;

export const initApiClientErrorHandling = RealApi.initApiClientErrorHandling;
export const hasProjectBeenRenamed = RealApi.hasProjectBeenRenamed;

export class Client extends MockClient {
  private realClient?: InstanceType<typeof RealClient>;

  constructor(...args: ConstructorParameters<typeof MockClient>) {
    super(...args);
    // Initialize real client for when __USE_REAL_API__ is true
    this.realClient = new RealClient(
      ...(args as ConstructorParameters<typeof RealClient>)
    );
  }

  clear(): void {
    if (globalThis.__USE_REAL_API__) {
      return this.realClient?.clear();
    }
    return super.clear();
  }

  wrapCallback<T extends any[]>(
    id: string,
    func: ((...args: T) => void) | undefined,
    cleanup = false
  ) {
    if (globalThis.__USE_REAL_API__) {
      return this.realClient?.wrapCallback(id, func, cleanup);
    }
    return super.wrapCallback(id, func, cleanup);
  }

  requestPromise(path: string, options?: any): Promise<any> {
    if (globalThis.__USE_REAL_API__) {
      return this.realClient?.requestPromise(path, options);
    }
    return super.requestPromise(path, options);
  }

  request(url: string, options?: any): any {
    if (globalThis.__USE_REAL_API__) {
      return this.realClient?.request(url, options);
    }
    return super.request(url, options);
  }
}
