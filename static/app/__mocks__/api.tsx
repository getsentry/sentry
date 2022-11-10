import isEqual from 'lodash/isEqual';

import type {HandleRequestErrorOptions, RequestOptions, ResponseMeta} from 'sentry/api';
import ModalStore from 'sentry/stores/modalStore';

import {SUDO_REQUIRED, SUPERUSER_REQUIRED} from '../constants/apiErrorCodes';

export class Request {}

export const initApiClientErrorHandling = () => false;
export const hasProjectBeenRenamed = (_args: any[]) => false;

const respond = (isAsync: boolean, fn?: Function, ...args: any[]): void => {
  if (!fn) {
    return;
  }

  if (isAsync) {
    setTimeout(() => fn(...args), 1);
    return;
  }

  fn(...args);
};

type FunctionCallback<Args extends any[] = any[]> = (...args: Args) => void;

/**
 * Callables for matching requests based on arbitrary conditions.
 */
interface MatchCallable {
  (url: string, options: RequestOptions): boolean;
}

type ResponseType = ResponseMeta & {
  body: any;
  callCount: 0;
  headers: Record<string, string>;
  match: MatchCallable[];
  method: string;
  statusCode: number;
  url: string;
};

type MockResponse = [resp: ResponseType, mock: jest.Mock];

/**
 * Compare two records. `want` is all the entries we want to have the same value in `check`
 */
function compareRecord(want: Record<string, any>, check: Record<string, any>): boolean {
  for (const key in want) {
    if (!isEqual(check[key], want[key])) {
      return false;
    }
  }
  return true;
}

afterEach(() => {
  // if any errors are caught we console.error them
  const errors = Object.values(Client.errors);
  if (errors.length > 0) {
    for (const err of errors) {
      // eslint-disable-next-line no-console
      console.error(err);
    }
    Client.errors = {};
  }
});

class Client implements Client {
  static mockResponses: MockResponse[] = [];

  static mockAsync = false;

  static clearMockResponses() {
    Client.mockResponses = [];
  }

  /**
   * Create a query string match callable.
   *
   * Only keys/values defined in `query` are checked.
   */
  static matchQuery(query: Record<string, any>): MatchCallable {
    const queryMatcher: MatchCallable = (_url, options) => {
      return compareRecord(query, options.query ?? {});
    };

    return queryMatcher;
  }

  /**
   * Create a data match callable.
   *
   * Only keys/values defined in `data` are checked.
   */
  static matchData(data: Record<string, any>): MatchCallable {
    const dataMatcher: MatchCallable = (_url, options) => {
      return compareRecord(data, options.data ?? {});
    };

    return dataMatcher;
  }

  // Returns a jest mock that represents Client.request calls
  static addMockResponse(response: Partial<ResponseType>) {
    const mock = jest.fn();

    Client.mockResponses.unshift([
      {
        url: '',
        status: 200,
        statusCode: 200,
        statusText: 'OK',
        responseText: '',
        responseJSON: '',
        body: '',
        method: 'GET',
        callCount: 0,
        match: [],
        ...response,
        headers: response.headers ?? {},
        getResponseHeader: (key: string) => response.headers?.[key] ?? null,
        rawResponse: {
          headers: new Headers(),
          ok: true,
          redirected: false,
          status: 200,
          statusText: 'OK',
          url: 'http://localhost',
          bodyUsed: false,
          body: {
            locked: false,
            cancel: jest.fn(),
            getReader: jest.fn(),
            pipeThrough: jest.fn(),
            pipeTo: jest.fn(),
            tee: jest.fn(),
          },
          blob: jest.fn(),
          arrayBuffer: jest.fn(),
          json: jest.fn(),
          text: jest.fn(),
          formData: jest.fn(),
          clone: jest.fn(),
          type: 'basic',
        },
      },
      mock,
    ]);

    return mock;
  }

  static findMockResponse(url: string, options: Readonly<RequestOptions>) {
    return Client.mockResponses.find(([response]) => {
      if (url !== response.url) {
        return false;
      }
      if ((options.method || 'GET') !== response.method) {
        return false;
      }
      return response.match.every(matcher => matcher(url, options));
    });
  }

  activeRequests: Record<string, typeof Request> = {};
  baseUrl = '';

  uniqueId() {
    return '123';
  }

  /**
   * In the real client, this clears in-flight responses. It's NOT
   * clearMockResponses. You probably don't want to call this from a test.
   */
  clear() {}

  wrapCallback<T extends any[]>(
    _id: string,
    func: FunctionCallback<T> | undefined,
    _cleanup: boolean = false
  ) {
    return (...args: T) => {
      if (hasProjectBeenRenamed(args)) {
        return;
      }
      respond(Client.mockAsync, func, ...args);
    };
  }

  requestPromise(
    path: string,
    {
      includeAllArgs,
      ...options
    }: {includeAllArgs?: boolean} & Readonly<RequestOptions> = {}
  ): any {
    return new Promise((resolve, reject) => {
      this.request(path, {
        ...options,
        success: (data, ...args) => {
          includeAllArgs ? resolve([data, ...args]) : resolve(data);
        },
        error: (error, ..._args) => {
          reject(error);
        },
      });
    });
  }

  static errors: Record<string, Error> = {};

  // XXX(ts): We type the return type for requestPromise and request as `any`. Typically these woul
  request(url: string, options: Readonly<RequestOptions> = {}): any {
    const [response, mock] = Client.findMockResponse(url, options) || [
      undefined,
      undefined,
    ];
    if (!response || !mock) {
      const methodAndUrl = `${options.method || 'GET'} ${url}`;
      // Endpoints need to be mocked
      const err = new Error(`No mocked response found for request: ${methodAndUrl}`);

      // Mutate stack to drop frames since test file so that we know where in the test
      // this needs to be mocked
      const lines = err.stack?.split('\n');
      const startIndex = lines?.findIndex(line => line.includes('.spec.'));
      err.stack = ['\n', lines?.[0], ...(lines?.slice(startIndex) ?? [])].join('\n');

      // Throwing an error here does not do what we want it to do....
      // Because we are mocking an API client, we generally catch errors to show
      // user-friendly error messages, this means in tests this error gets gobbled
      // up and developer frustration ensues.
      // We track the errors on a static member and warn afterEach test.
      Client.errors[methodAndUrl] = err;
    } else {
      // has mocked response

      // mock gets returned when we add a mock response, will represent calls to api.request
      mock(url, options);

      const body =
        typeof response.body === 'function' ? response.body(url, options) : response.body;

      if (![200, 202].includes(response.statusCode)) {
        response.callCount++;

        const errorResponse = Object.assign(
          {
            status: response.statusCode,
            responseText: JSON.stringify(body),
            responseJSON: body,
          },
          {
            overrideMimeType: () => {},
            abort: () => {},
            then: () => {},
            error: () => {},
          },
          new XMLHttpRequest()
        );

        this.handleRequestError(
          {
            id: '1234',
            path: url,
            requestOptions: options,
          },
          errorResponse as any,
          'error',
          'error'
        );
      } else {
        response.callCount++;
        respond(
          Client.mockAsync,
          options.success,
          body,
          {},
          {
            getResponseHeader: (key: string) => response.headers[key],
            statusCode: response.statusCode,
            status: response.statusCode,
          }
        );
      }
    }

    respond(Client.mockAsync, options.complete);
  }

  handleRequestError(
    {id, path, requestOptions}: HandleRequestErrorOptions,
    response: ResponseMeta,
    textStatus: string,
    errorThrown: string
  ) {
    const code = response?.responseJSON?.detail?.code;
    const isSudoRequired = code === SUDO_REQUIRED || code === SUPERUSER_REQUIRED;

    let didSuccessfullyRetry = false;

    if (isSudoRequired) {
      openSudo({
        isSuperuser: code === SUPERUSER_REQUIRED,
        sudo: code === SUDO_REQUIRED,
        retryRequest: async () => {
          try {
            const data = await this.requestPromise(path, requestOptions);
            requestOptions.success?.(data);
            didSuccessfullyRetry = true;
          } catch (err) {
            requestOptions.error?.(err);
          }
        },
        onClose: () =>
          // If modal was closed, then forward the original response
          !didSuccessfullyRetry && requestOptions.error?.(response),
      });
      return;
    }

    const errorCb = this.wrapCallback<[ResponseMeta, string, string]>(
      id,
      requestOptions.error
    );
    errorCb?.(response, textStatus, errorThrown);
  }
}

async function openSudo({onClose, ...args}: any = {}) {
  const mod = await import('sentry/components/modals/sudoModal');
  const {default: Modal} = mod;

  openModal(deps => <Modal {...deps} {...args} />, {onClose});
}

function openModal(renderer: (renderProps: any) => React.ReactNode, options?: any) {
  ModalStore.openModal(renderer, options ?? {});
}

export {Client};
