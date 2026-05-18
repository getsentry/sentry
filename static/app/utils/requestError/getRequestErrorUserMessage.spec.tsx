import type {ResponseMeta} from 'sentry/api';
import {RequestError} from 'sentry/utils/requestError/requestError';

import {getRequestErrorUserMessage} from './getRequestErrorUserMessage';

describe('getRequestErrorUserMessage', () => {
  it('returns string detail from the API when present', () => {
    const err = new RequestError('GET', '/api/', new Error('x'), {
      status: 500,
      responseJSON: {detail: 'Custom server message'},
    } as ResponseMeta);
    expect(getRequestErrorUserMessage(err)).toBe('Custom server message');
  });

  it('returns message from object detail when present', () => {
    const err = new RequestError('GET', '/api/', new Error('x'), {
      status: 400,
      responseJSON: {detail: {message: 'Structured detail'}},
    } as ResponseMeta);
    expect(getRequestErrorUserMessage(err)).toBe('Structured detail');
  });

  it('maps 429 to rate-limit copy', () => {
    const err = new RequestError('GET', '/api/', new Error('x'), {
      status: 429,
    } as ResponseMeta);
    expect(getRequestErrorUserMessage(err)).toBe(
      'API requests have been temporarily rate-limited. Please wait a moment and try again.'
    );
  });

  it('uses the provided fallback for unknown RequestError shapes', () => {
    const err = new RequestError('GET', '/api/', new Error('x'), {
      status: 418,
    } as ResponseMeta);
    expect(getRequestErrorUserMessage(err, 'fallback')).toBe('fallback');
  });

  it('returns message for generic Error instances', () => {
    expect(getRequestErrorUserMessage(new Error('oops'))).toBe('oops');
  });

  it('returns fallback for non-errors', () => {
    expect(getRequestErrorUserMessage(null, 'nope')).toBe('nope');
  });
});
