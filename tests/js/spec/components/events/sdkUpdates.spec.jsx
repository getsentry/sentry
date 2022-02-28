import {enzymeRender} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import EventSdkUpdates from 'sentry/components/events/sdkUpdates';

describe('EventSdkUpdates', function () {
  const {routerContext} = initializeOrg();

  it('renders a suggestion to update the sdk and then enable an integration', function () {
    const props = {
      event: TestStubs.UpdateSdkAndEnableIntegrationSuggestion(),
    };

    const wrapper = enzymeRender(<EventSdkUpdates {...props} />, routerContext);
    expect(wrapper).toSnapshot();
  });
});
