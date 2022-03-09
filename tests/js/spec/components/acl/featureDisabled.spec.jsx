import {fireEvent, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import FeatureDisabled from 'sentry/components/acl/featureDisabled';

describe('FeatureDisabled', function () {
  it('renders', function () {
    mountWithTheme(
      <FeatureDisabled
        features={['organization:my-features']}
        featureName="Some Feature"
      />
    );

    expect(
      screen.getByText('This feature is not enabled on your Sentry installation.')
    ).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('renders with custom message', function () {
    const customMessage = 'custom message';
    mountWithTheme(
      <FeatureDisabled
        message={customMessage}
        features={['organization:my-features']}
        featureName="Some Feature"
      />
    );

    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('renders with custom alert component', function () {
    const customAlert = jest.fn().mockReturnValue(null);
    mountWithTheme(
      <FeatureDisabled
        alert={customAlert}
        features={['organization:my-features']}
        featureName="Some Feature"
      />
    );
    expect(customAlert).toHaveBeenCalled();
  });

  it('displays instructions when help is clicked', function () {
    mountWithTheme(
      <FeatureDisabled
        alert
        features={['organization:my-features']}
        featureName="Some Feature"
      />
    );
    fireEvent.click(screen.getByText('Help'));
    expect(
      screen.getByText(/Enable this feature on your sentry installation/)
    ).toBeInTheDocument();
  });
});
