import Cookies from 'js-cookie';

import {setWindowLocation} from 'sentry-test/utils';

import {redirectToProject} from 'sentry/actionCreators/redirectToProject';
import {openSudo} from 'sentry/actionCreators/sudoModal';
import type {ResponseMeta} from 'sentry/api';
import type {QueryKeyEndpointOptions} from 'sentry/utils/api/apiQueryKey';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import type {ApiResponse} from './sentryCellFetch';
import {
  createDefaultAuthErrorHandler,
  createDefaultErrorHandlers,
  createDefaultProjectRenamedHandler,
  createDefaultSudoHandler,
} from './sentryCellFetchErrorHandlers';

jest.mock('sentry/actionCreators/sudoModal');
jest.mock('sentry/actionCreators/redirectToProject');

function makeResponse(overrides: Partial<ResponseMeta> = {}): ResponseMeta {
  return {
    status: 401,
    statusText: 'Unauthorized',
    responseJSON: undefined,
    responseText: '',
    getResponseHeader: jest.fn().mockReturnValue(null),
    ...overrides,
  };
}

function makeOptions(
  overrides: Partial<QueryKeyEndpointOptions> = {}
): QueryKeyEndpointOptions {
  return {
    method: 'GET',
    ...overrides,
  };
}

describe('createDefaultAuthErrorHandler', () => {
  const navigate = jest.fn();
  let handler: ReturnType<typeof createDefaultAuthErrorHandler>;

  beforeEach(() => {
    navigate.mockReset();
    handler = createDefaultAuthErrorHandler({navigate});
    jest.mocked(testableWindowLocation.assign).mockReset();
    jest.mocked(testableWindowLocation.reload).mockReset();
  });

  afterEach(() => {
    setWindowLocation('http://localhost/');
  });

  it('returns false for allowed anonymous pages', () => {
    setWindowLocation('http://localhost/accept/123/');

    const result = handler(makeResponse(), makeOptions());

    expect(result).toBe(false);
  });

  it('returns false when allowAuthError is set', () => {
    const result = handler(makeResponse(), makeOptions({allowAuthError: true}));

    expect(result).toBe(false);
  });

  it('returns false for sudo-required code', () => {
    const response = makeResponse({
      responseJSON: {detail: {code: 'sudo-required'}},
    });

    expect(handler(response, makeOptions())).toBe(false);
  });

  it('returns false for 2fa-required code', () => {
    const response = makeResponse({
      responseJSON: {detail: {code: '2fa-required'}},
    });

    expect(handler(response, makeOptions())).toBe(false);
  });

  it('returns false for ignore code', () => {
    const response = makeResponse({
      responseJSON: {detail: {code: 'ignore'}},
    });

    expect(handler(response, makeOptions())).toBe(false);
  });

  it('returns false for app-connect-authentication-error code', () => {
    const response = makeResponse({
      responseJSON: {detail: {code: 'app-connect-authentication-error'}},
    });

    expect(handler(response, makeOptions())).toBe(false);
  });

  it('redirects to SSO login URL for sso-required code', () => {
    const response = makeResponse({
      responseJSON: {
        detail: {code: 'sso-required', extra: {loginUrl: 'https://sso.example.com'}},
      },
    });

    const result = handler(response, makeOptions());

    expect(result).toBe(true);
    expect(testableWindowLocation.assign).toHaveBeenCalledWith('https://sso.example.com');
  });

  it('navigates for member-disabled-over-limit code', () => {
    const response = makeResponse({
      responseJSON: {
        detail: {code: 'member-disabled-over-limit', extra: {next: '/disabled/'}},
      },
    });

    const result = handler(response, makeOptions());

    expect(result).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/disabled/', {replace: true});
  });

  it('sets session_expired cookie for general auth failure', () => {
    const cookieSpy = jest.spyOn(Cookies, 'set');

    const result = handler(makeResponse(), makeOptions());

    expect(result).toBe(true);
    expect(cookieSpy).toHaveBeenCalledWith('session_expired', '1');

    cookieSpy.mockRestore();
  });

  it('calls reload for general auth failure in non-SPA mode', () => {
    handler(makeResponse(), makeOptions());

    expect(testableWindowLocation.reload).toHaveBeenCalled();
  });
});

describe('createDefaultSudoHandler', () => {
  const mockedOpenSudo = jest.mocked(openSudo);
  let handler: ReturnType<typeof createDefaultSudoHandler>;

  beforeEach(() => {
    mockedOpenSudo.mockReset();
    handler = createDefaultSudoHandler();
  });

  it('opens sudo modal with correct flags for sudo-required', () => {
    const response = makeResponse({
      status: 403,
      responseJSON: {detail: {code: 'sudo-required'}},
    });
    const retry = jest.fn();

    handler(response, retry);

    expect(mockedOpenSudo).toHaveBeenCalledWith(
      expect.objectContaining({
        sudo: true,
        isSuperuser: false,
      })
    );
  });

  it('opens sudo modal with correct flags for superuser-required', () => {
    const response = makeResponse({
      status: 403,
      responseJSON: {detail: {code: 'superuser-required'}},
    });
    const retry = jest.fn();

    handler(response, retry);

    expect(mockedOpenSudo).toHaveBeenCalledWith(
      expect.objectContaining({
        sudo: false,
        isSuperuser: true,
      })
    );
  });

  it('resolves with retry result on successful retry', async () => {
    const retryResult: ApiResponse = {headers: {}, json: {id: 1}};
    const retry = jest.fn().mockResolvedValue(retryResult);

    mockedOpenSudo.mockImplementation(opts => {
      opts?.retryRequest?.();
      return Promise.resolve();
    });

    const response = makeResponse({
      status: 403,
      responseJSON: {detail: {code: 'sudo-required'}},
    });

    const result = await handler(response, retry);

    expect(retry).toHaveBeenCalledTimes(1);
    expect(result).toBe(retryResult);
  });

  it('rejects when retry fails', async () => {
    const retryError = new Error('Retry failed');
    const retry = jest.fn().mockRejectedValue(retryError);

    mockedOpenSudo.mockImplementation(opts => {
      opts?.retryRequest?.();
      return Promise.resolve();
    });

    const response = makeResponse({
      status: 403,
      responseJSON: {detail: {code: 'sudo-required'}},
    });

    await expect(handler(response, retry)).rejects.toBe(retryError);
  });

  it('rejects with RequestError when modal is closed without retry', async () => {
    mockedOpenSudo.mockImplementation(opts => {
      opts?.onClose?.();
      return Promise.resolve();
    });

    const response = makeResponse({
      status: 403,
      responseJSON: {detail: {code: 'sudo-required'}},
    });
    const retry = jest.fn();

    await expect(handler(response, retry)).rejects.toThrow(RequestError);
    expect(retry).not.toHaveBeenCalled();
  });
});

describe('createDefaultProjectRenamedHandler', () => {
  const mockedRedirect = jest.mocked(redirectToProject);
  let handler: ReturnType<typeof createDefaultProjectRenamedHandler>;

  beforeEach(() => {
    mockedRedirect.mockReset();
    handler = createDefaultProjectRenamedHandler();
  });

  it('calls redirectToProject with the new slug', () => {
    const response = makeResponse({
      responseJSON: {
        detail: {code: 'project-moved', extra: {slug: 'new-project-slug'}},
      },
    });

    const result = handler(response);

    expect(result).toBe(true);
    expect(mockedRedirect).toHaveBeenCalledWith('new-project-slug');
  });
});

describe('createDefaultErrorHandlers', () => {
  it('returns all three handlers', () => {
    const handlers = createDefaultErrorHandlers({navigate: jest.fn()});

    expect(handlers.onAuthError).toBeInstanceOf(Function);
    expect(handlers.onSudoRequired).toBeInstanceOf(Function);
    expect(handlers.onProjectRenamed).toBeInstanceOf(Function);
  });
});
