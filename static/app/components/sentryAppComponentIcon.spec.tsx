import {SentryAppComponentFixture} from 'sentry-fixture/sentryAppComponent';

import {sentryAppComponentIsDisabled} from 'sentry/components/sentryAppComponentIcon';

describe('SentryAppComponentIcon', function () {
  it('sentryAppComponentIsDisabled returns false if the error is a non empty string', () => {
    const component = SentryAppComponentFixture();
    component.error = 'RIP couldnt connect to sentry :C';
    expect(sentryAppComponentIsDisabled(component)).toBe(false);
  });

  it('sentryAppComponentIsDisabled returns true if the error is an empty string', () => {
    const component = SentryAppComponentFixture();
    component.error = '';
    expect(sentryAppComponentIsDisabled(component)).toBe(true);
  });

  // TODO: Delete after new errors are deployed
  it('sentryAppComponentIsDisabled returns itself if the error is a boolean', () => {
    const component = SentryAppComponentFixture();
    component.error = true;
    expect(sentryAppComponentIsDisabled(component)).toBe(true);
  });
});
