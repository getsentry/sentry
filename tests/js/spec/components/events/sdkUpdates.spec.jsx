import React from 'react';
import {mount} from 'enzyme';
import {initializeOrg} from 'app-test/helpers/initializeOrg';
import EventSdkUpdates from 'app/components/events/sdkUpdates';

describe('EventSdkUpdates', function() {
  const {routerContext} = initializeOrg();

  it('renders a suggestion to update the sdk and then enable an integration', function() {
    const props = {
      event: TestStubs.UpdateSdkAndEnableIntegrationSuggestion(),
    };

    const wrapper = mount(<EventSdkUpdates {...props} />, routerContext);
    expect(wrapper).toMatchSnapshot();
  });
});
