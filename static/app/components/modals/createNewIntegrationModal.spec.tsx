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

});
