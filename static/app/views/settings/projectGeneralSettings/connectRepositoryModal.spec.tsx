import {Fragment} from 'react';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

// Mock the virtualizer so all menu items render in JSDOM (no layout engine).
jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: jest.fn(({count, paddingStart = 0, paddingEnd = 0}) => ({
    getVirtualItems: () =>
      Array.from({length: count}, (_, i) => ({
        key: i,
        index: i,
        start: paddingStart + i * 36,
        size: 36,
      })),
    getTotalSize: () => paddingStart + count * 36 + paddingEnd,
    measure: jest.fn(),
    measureElement: jest.fn(),
    scrollToIndex: jest.fn(),
  })),
}));

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
    const input = screen.getByRole('textbox', {name: /project/i});
    expect(input).toBeDisabled();
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
    expect(screen.getByText('getsentry/sentry')).toBeInTheDocument();
  });

  it('Cancel closes the modal', async () => {
    const closeModal = jest.fn();
    renderModal(closeModal);
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(closeModal).toHaveBeenCalled();
  });
});
