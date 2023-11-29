import {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {FeatureDisabledModal} from 'sentry/components/acl/featureDisabledModal';
import ModalStore from 'sentry/stores/modalStore';

describe('FeatureTourModal', function () {
  const onCloseModal = jest.fn();
  const styledWrapper = styled(c => c.children);
  const renderComponent = (
    props: Partial<ComponentProps<typeof FeatureDisabledModal>> = {}
  ) =>
    render(
      <FeatureDisabledModal
        Body={styledWrapper()}
        Footer={styledWrapper()}
        Header={() => <span>Header</span>}
        closeModal={onCloseModal}
        CloseButton={() => <button>Close</button>}
        featureName="Default Feature"
        features="organization:test-feature"
        {...props}
      />
    );

  beforeEach(function () {
    ModalStore.reset();
    jest.clearAllMocks();
  });

  it('renders', function () {
    const featureName = 'Custom Feature';
    const features = ['organization:custom-feature'];

    renderComponent({
      featureName,
      features,
    });

    expect(
      screen.getByText('This feature is not enabled on your Sentry installation.')
    ).toBeInTheDocument();

    expect(screen.getByText(/# Enables the Custom Feature feature/)).toBeInTheDocument();
    expect(
      screen.getByText(/SENTRY_FEATURES\['organization:custom-feature'\] = True/)
    ).toBeInTheDocument();
  });

  it('renders with custom message', function () {
    const message = 'custom message';

    renderComponent({
      message,
    });

    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
