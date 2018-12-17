import React from 'react';

import FeatureDisabled from 'app/components/acl/featureDisabled';
import {mount} from 'enzyme';

describe('FeatureDisabled', function() {
  const routerContext = TestStubs.routerContext();

  it('renders', function() {
    const wrapper = mount(
      <FeatureDisabled feature={'organization:my-feature'} featureName="Some Feature" />,
      routerContext
    );

    expect(
      wrapper
        .find('Flex')
        .first()
        .text()
    ).toEqual(
      expect.stringContaining('This feature is not enabled on your Sentry installation.')
    );
    expect(wrapper.exists('HelpButton')).toBe(true);
  });

  it('renders as an Alert', function() {
    const wrapper = mount(
      <FeatureDisabled
        alert
        feature={'organization:my-feature'}
        featureName="Some Feature"
      />,
      routerContext
    );

    expect(wrapper.exists('Alert')).toBe(true);
  });

  it('displays instructions when help is clicked', function() {
    const wrapper = mount(
      <FeatureDisabled
        alert
        feature={'organization:my-feature'}
        featureName="Some Feature"
      />,
      routerContext
    );

    wrapper.find('HelpButton').simulate('click');
    wrapper.update();

    expect(wrapper.exists('HelpDescription')).toBe(true);
  });
});
