import * as Sentry from '@sentry/react';

import {toast} from '@sentry/scraps/toast';

import {addMessage, addErrorMessage, addSuccessMessage, addLoadingMessage} from './indicator';

jest.mock('@sentry/react', () => ({
  captureException: jest.fn(),
}));

jest.mock('@sentry/scraps/toast', () => ({
  toast: {
    loading: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    message: jest.fn(),
    dismiss: jest.fn(),
  },
}));

jest.mock('sentry/utils/demoMode', () => ({
  isDemoModeActive: jest.fn().mockReturnValue(false),
}));

describe('addMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes a plain string message to toast', () => {
    addMessage('hello world', 'success');
    expect(toast.success).toHaveBeenCalledWith('hello world', expect.anything());
  });

  it('extracts the string message from an API error object {code, message, extra}', () => {
    const apiError = {code: 'some_code', message: 'Something went wrong', extra: {}};
    addMessage(apiError as any, 'error');

    // The raw object must NOT reach the toast call
    expect(toast.error).not.toHaveBeenCalledWith(apiError, expect.anything());
    // The extracted string MUST be passed instead
    expect(toast.error).toHaveBeenCalledWith('Something went wrong', expect.anything());
  });

  it('captures a Sentry exception when an API error object is detected', () => {
    const apiError = {code: 'some_code', message: 'Something went wrong', extra: {}};
    addMessage(apiError as any, 'error');
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({message: 'Attempt to XHR response to Indicators'})
    );
  });

  it('does not sanitize when message key is present but code or extra is missing', () => {
    const partialObj = {message: 'hello'};
    addMessage(partialObj as any, 'success');
    // No extraction; raw value forwarded (would still be an object but not our API error pattern)
    expect(toast.success).toHaveBeenCalledWith(partialObj, expect.anything());
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

describe('addErrorMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes string messages through', () => {
    addErrorMessage('oops');
    expect(toast.error).toHaveBeenCalledWith('oops', expect.anything());
  });

  it('does not pass a raw API error object to toast (uses its own fallback)', () => {
    // addErrorMessage has its own guard for non-string/non-element values and
    // substitutes a generic user-facing message, so the raw object never reaches toast.
    const apiError = {code: 'err', message: 'API failed', extra: {detail: 'x'}};
    addErrorMessage(apiError as any);
    expect(toast.error).not.toHaveBeenCalledWith(apiError, expect.anything());
    // The generic fallback string is used (not the raw object, not the extracted .message)
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});

describe('addSuccessMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sanitizes an API error object so React does not crash', () => {
    const apiError = {code: 'ok', message: 'Saved!', extra: {}};
    addSuccessMessage(apiError as any);
    expect(toast.success).not.toHaveBeenCalledWith(apiError, expect.anything());
    expect(toast.success).toHaveBeenCalledWith('Saved!', expect.anything());
  });
});

describe('addLoadingMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sanitizes an API error object so React does not crash', () => {
    const apiError = {code: 'loading', message: 'Loading…', extra: {}};
    addLoadingMessage(apiError as any);
    expect(toast.loading).not.toHaveBeenCalledWith(apiError, expect.anything());
    expect(toast.loading).toHaveBeenCalledWith('Loading…', expect.anything());
  });
});
