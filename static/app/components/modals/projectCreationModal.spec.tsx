import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {MOCK_RESP_VERBOSE} from 'sentry-fixture/ruleConditions';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import ProjectCreationModal from 'sentry/components/modals/projectCreationModal';
import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';

describe('Project Creation Modal', function () {
  const closeModal = jest.fn();
  const organization = OrganizationFixture();

  it('renders modal', async function () {
    render(
      <ProjectCreationModal
        defaultCategory="browser"
        Body={ModalBody}
        closeModal={jest.fn()}
        CloseButton={makeCloseButton(jest.fn())}
        Header={makeClosableHeader(jest.fn())}
        Footer={ModalFooter}
      />
    );

    expect(await screen.findByText('Create a Project')).toBeInTheDocument();
  });

  it('closes modal when closed', async function () {
    render(
      <ProjectCreationModal
        defaultCategory="browser"
        Body={ModalBody}
        closeModal={closeModal}
        CloseButton={makeCloseButton(closeModal)}
        Header={makeClosableHeader(closeModal)}
        Footer={ModalFooter}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
    expect(closeModal).toHaveBeenCalled();
  });

  it('creates project', async function () {
    const team = TeamFixture({
      access: ['team:admin', 'team:write', 'team:read'],
    });
    const integrations = [
      OrganizationIntegrationsFixture({
        name: "Moo Deng's Workspace",
        status: 'active',
      }),
    ];

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/rule-conditions/`,
      body: MOCK_RESP_VERBOSE,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [team],
    });

    MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${team.slug}/projects/`,
      method: 'POST',
      body: {slug: 'test-react-project'},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: organization,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/?integrationType=messaging`,
      body: integrations,
    });

    OrganizationStore.onUpdate(organization);
    TeamStore.loadUserTeams([team]);

    render(
      <ProjectCreationModal
        defaultCategory="browser"
        Body={ModalBody}
        closeModal={closeModal}
        CloseButton={makeCloseButton(closeModal)}
        Header={makeClosableHeader(closeModal)}
        Footer={ModalFooter}
      />
    );

    expect(screen.getByRole('button', {name: 'Next Step'})).toBeDisabled();
    await userEvent.click(screen.getByTestId('platform-javascript-react'));

    expect(screen.getByRole('button', {name: 'Next Step'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Next Step'}));

    expect(screen.getByRole('button', {name: 'Create Project'})).toBeDisabled();

    expect(await screen.findByText('Set your alert frequency')).toBeInTheDocument();
    await userEvent.click(screen.getByText("I'll create my own alerts later"));

    expect(
      await screen.findByText('Name your project and assign it a team')
    ).toBeInTheDocument();
    await userEvent.type(
      screen.getByPlaceholderText('project-name'),
      'test-react-project'
    );

    await userEvent.type(screen.getByLabelText('Select a Team'), team.slug);
    await userEvent.click(screen.getByText(`#${team.slug}`));

    expect(screen.getByRole('button', {name: 'Create Project'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));

    expect(closeModal).toHaveBeenCalled();
  });
});
