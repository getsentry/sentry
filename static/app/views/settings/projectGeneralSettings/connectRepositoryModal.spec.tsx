import {Fragment} from 'react';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from '@sentry/scraps/modal';

import {ConnectRepositoryModal} from 'sentry/views/settings/projectGeneralSettings/connectRepositoryModal';

describe('ConnectRepositoryModal', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture();
  const integration = GitHubIntegrationFixture();

  function renderModal(closeModal = jest.fn()) {
    return render(
      <Fragment>
        <ConnectRepositoryModal
          Body={ModalBody}
          Footer={ModalFooter}
          Header={makeClosableHeader(jest.fn())}
          CloseButton={makeCloseButton(closeModal)}
          closeModal={closeModal}
          project={project}
        />
      </Fragment>,
      {organization}
    );
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      method: 'GET',
      body: [integration],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${integration.id}/repos/`,
      method: 'GET',
      body: {
        repos: [
          {
            name: 'getsentry/sentry',
            identifier: 'getsentry/sentry',
            externalId: '1',
            isInstalled: false,
            defaultBranch: 'main',
          },
          {
            name: 'getsentry/relay',
            identifier: 'getsentry/relay',
            externalId: '2',
            isInstalled: false,
            defaultBranch: 'master',
          },
        ],
      },
    });
  });

  it('includes the project name in the title', () => {
    renderModal();
    expect(
      screen.getByText(`Connect a repository to ${project.slug}`)
    ).toBeInTheDocument();
  });

  it('shows the project name as a locked read-only field', () => {
    renderModal();
    const combobox = screen.getByRole('combobox', {name: /project/i});
    expect(combobox).toBeInTheDocument();
    expect(combobox).toBeDisabled();
    expect(combobox).toHaveValue(project.slug);
  });

  it('lists repos from mock integration in the dropdown', async () => {
    renderModal();
    await userEvent.click(screen.getByText('Search repositories'));
    expect(await screen.findByText('getsentry/sentry')).toBeInTheDocument();
    expect(screen.getByText('getsentry/relay')).toBeInTheDocument();
  });

  it('shows paths placeholder before a repo is chosen', async () => {
    renderModal();
    expect(
      await screen.findByText('Select a repository first to configure code paths')
    ).toBeInTheDocument();
  });

  it('Save button is disabled', async () => {
    renderModal();
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Save'})).toBeDisabled()
    );
  });

  it('shows the selected repo in the combobox after picking', async () => {
    renderModal();
    await userEvent.click(screen.getByText('Search repositories'));
    await userEvent.click(await screen.findByText('getsentry/sentry'));
    expect(screen.getByRole('combobox')).toHaveValue('getsentry/sentry');
  });

  it('Cancel closes the modal', async () => {
    const closeModal = jest.fn();
    renderModal(closeModal);
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(closeModal).toHaveBeenCalled();
  });
});
