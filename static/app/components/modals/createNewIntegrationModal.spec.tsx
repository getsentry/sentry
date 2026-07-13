import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderGlobalModal, screen} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import CreateNewIntegrationModal from 'sentry/components/modals/createNewIntegrationModal';

describe('CreateNewIntegrationModal', () => {
  it('offers starting from scratch', () => {
    renderGlobalModal();

    act(() => openModal(modalProps => <CreateNewIntegrationModal {...modalProps} />));

    expect(screen.getByText('Internal Integration')).toBeInTheDocument();
    expect(screen.getByText('Public Integration')).toBeInTheDocument();

    const buttons = screen.getAllByRole('button', {name: 'Get started'});
    expect(buttons[0]).toHaveAttribute(
      'href',
      '/settings/org-slug/developer-settings/new-internal/'
    );
    expect(buttons[1]).toHaveAttribute(
      'href',
      '/settings/org-slug/developer-settings/new-public/'
    );

    expect(screen.queryByText('Templates')).not.toBeInTheDocument();
  });

  it('offers visible creation templates', () => {
    renderGlobalModal({
      organization: OrganizationFixture({
        features: [
          'sentry-apps-creation-templates',
          'sentry-apps-custom-webhook-headers',
        ],
      }),
    });

    act(() => openModal(modalProps => <CreateNewIntegrationModal {...modalProps} />));

    expect(screen.getByText('Templates')).toBeInTheDocument();
    expect(screen.getByText('Trigger a Claude routine')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Use template'})).toHaveAttribute(
      'href',
      '/settings/org-slug/developer-settings/new-internal/?template=claude-routine&referrer=new_integration_modal'
    );
  });

  it('hides templates the org lacks features for', () => {
    renderGlobalModal();

    act(() => openModal(modalProps => <CreateNewIntegrationModal {...modalProps} />));

    expect(screen.queryByText('Trigger a Claude routine')).not.toBeInTheDocument();
  });
});
