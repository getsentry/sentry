import {UpdateSdkAndEnableIntegrationSuggestion} from 'fixtures/js-stubs/updateSdkAndEnableIntegrationSuggestion';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render} from 'sentry-test/reactTestingLibrary';

import EventSdkUpdates from 'sentry/components/events/sdkUpdates';

describe('EventSdkUpdates', function () {
  const {routerContext} = initializeOrg();

  it('renders a suggestion to update the sdk and then enable an integration', function () {
    const props = {
      event: UpdateSdkAndEnableIntegrationSuggestion(),
    };

    const wrapper = render(<EventSdkUpdates {...props} />, {context: routerContext});
    expect(wrapper.container).toSnapshot();
  });
});
