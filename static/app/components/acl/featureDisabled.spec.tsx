import {fireEvent, render, screen} from 'sentry-test/reactTestingLibrary';

import FeatureDisabled from 'sentry/components/acl/featureDisabled';

describe('FeatureDisabled', function () {
  it('renders', function () {
    render(
      <FeatureDisabled features="organization:my-features" featureName="Some Feature" />
    );

    expect(
      screen.getByText('This feature is not enabled on your Sentry installation.')
    ).toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('supports a list of disabled features', function () {
    render(
      <FeatureDisabled
        features={['organization:my-features', 'organization:other-feature']}
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
    render(
      <FeatureDisabled
        message={customMessage}
        features="organization:my-features"
        featureName="Some Feature"
      />
    );

    expect(screen.getByText(customMessage)).toBeInTheDocument();
  });

  it('renders with custom alert component', function () {
    const customAlert = jest.fn().mockReturnValue(null);
    render(
      <FeatureDisabled
        alert={customAlert}
        features="organization:my-features"
        featureName="Some Feature"
      />
    );
    expect(customAlert).toHaveBeenCalled();
  });

  it('displays instructions when help is clicked', function () {
    render(
      <FeatureDisabled
        alert
        features="organization:my-features"
        featureName="Some Feature"
      />
    );
    fireEvent.click(
      screen.getByText('This feature is not enabled on your Sentry installation.')
    );
    expect(
      screen.getByText(/Enable this feature on your sentry installation/)
    ).toBeInTheDocument();
  });
});
