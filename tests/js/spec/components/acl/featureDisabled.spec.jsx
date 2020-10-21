import {mountWithTheme} from 'sentry-test/enzyme';

import {PanelAlert} from 'app/components/panels';
import FeatureDisabled from 'app/components/acl/featureDisabled';

describe('FeatureDisabled', function () {
  const routerContext = TestStubs.routerContext();

  it('renders', function () {
    const wrapper = mountWithTheme(
      <FeatureDisabled
        features={['organization:my-features']}
        featureName="Some Feature"
      />,
      routerContext
    );

    expect(wrapper.find('FeatureDisabledMessage').first().text()).toEqual(
      expect.stringContaining('This feature is not enabled on your Sentry installation.')
    );
    expect(wrapper.exists('HelpButton')).toBe(true);
  });

  it('renders with custom message', function () {
    const customMessage = 'custom message';
    const wrapper = mountWithTheme(
      <FeatureDisabled
        message={customMessage}
        features={['organization:my-features']}
        featureName="Some Feature"
      />,
      routerContext
    );

    expect(wrapper.find('FeatureDisabledMessage').first().text()).toEqual(
      expect.stringContaining(customMessage)
    );
  });

  it('renders as an Alert', function () {
    const wrapper = mountWithTheme(
      <FeatureDisabled
        alert
        features={['organization:my-features']}
        featureName="Some Feature"
      />,
      routerContext
    );

    expect(wrapper.exists('Alert')).toBe(true);
  });

  it('renders with custom alert component', function () {
    const wrapper = mountWithTheme(
      <FeatureDisabled
        alert={PanelAlert}
        features={['organization:my-features']}
        featureName="Some Feature"
      />,
      routerContext
    );

    expect(wrapper.exists('PanelAlert')).toBe(true);
  });

  it('displays instructions when help is clicked', function () {
    const wrapper = mountWithTheme(
      <FeatureDisabled
        alert
        features={['organization:my-features']}
        featureName="Some Feature"
      />,
      routerContext
    );

    wrapper.find('HelpButton').simulate('click');
    wrapper.update();

    expect(wrapper.exists('HelpDescription')).toBe(true);
  });
});
