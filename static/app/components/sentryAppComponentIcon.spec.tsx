import {SentryAppComponentFixture} from 'sentry-fixture/sentryAppComponent';

import {getSentryAppComponentIsDisabled} from 'sentry/components/sentryAppComponentIcon';

describe('SentryAppComponentIcon', function () {
  it('returns false if the error is a non empty string', () => {
    const component = SentryAppComponentFixture();
    component.error = 'RIP couldnt connect to sentry :C';
    expect(getSentryAppComponentIsDisabled(component)).toBe(false);
  });

  it('returns true if the error is an empty string', () => {
    const component = SentryAppComponentFixture();
    component.error = '';
    expect(getSentryAppComponentIsDisabled(component)).toBe(true);
  });

  // TODO: Delete after new errors are deployed
  it('returns itself if the error is a boolean', () => {
    const component = SentryAppComponentFixture();
    component.error = true;
    expect(getSentryAppComponentIsDisabled(component)).toBe(true);
  });
});
