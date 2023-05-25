import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import {Organization} from 'sentry/types';
import {CreateProject} from 'sentry/views/projectInstall/createProject';

function renderFrameworkModalMockRequests({
  organization,
  teamSlug,
}: {
  organization: Organization;
  teamSlug: string;
}) {
  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/rule-conditions/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/teams/`,
    body: [TestStubs.Team({slug: teamSlug})],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/`,
    body: organization,
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/projects/`,
    body: [],
  });

  const projectCreationMockRequest = MockApiClient.addMockResponse({
    url: `/teams/${organization.slug}/${teamSlug}/projects/`,
    method: 'POST',
  });

  return {projectCreationMockRequest};
}

describe('CreateProject', function () {
  const teamNoAccess = TestStubs.Team({
    slug: 'test',
    id: '1',
    name: 'test',
    access: ['team:read'],
  });

  const teamWithAccess = {
    ...teamNoAccess,
    access: ['team:admin', 'team:write', 'team:read'],
  };

  beforeEach(() => {
    TeamStore.reset();
    TeamStore.loadUserTeams([teamNoAccess]);

    MockApiClient.addMockResponse({
      url: `/projects/testOrg/rule-conditions/`,
      body: {},
      // Not required for these tests
      statusCode: 500,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should block if you have access to no teams', function () {
    const {container} = render(<CreateProject />, {
      context: TestStubs.routerContext([{organization: {id: '1', slug: 'testOrg'}}]),
    });
    expect(container).toSnapshot();
  });

  it('can create a new team', async function () {
    render(<CreateProject />, {
      context: TestStubs.routerContext([{organization: {id: '1', slug: 'testOrg'}}]),
    });

    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Create a team'}));

    expect(
      await screen.findByText(
        'Members of a team have access to specific areas, such as a new release or a new application feature.'
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));
  });

  it('should fill in project name if its empty when platform is chosen', async function () {
    const organization = TestStubs.Organization();

    const {container} = render(<CreateProject />, {
      context: TestStubs.routerContext([{organization: {id: '1', slug: 'testOrg'}}]),
      organization,
    });

    await userEvent.click(screen.getByTestId('platform-apple-ios'));
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('apple-ios');

    await userEvent.click(screen.getByTestId('platform-ruby-rails'));
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('ruby-rails');

    // but not replace it when project name is something else:
    await userEvent.clear(screen.getByPlaceholderText('project-name'));
    await userEvent.type(screen.getByPlaceholderText('project-name'), 'another');

    await userEvent.click(screen.getByTestId('platform-apple-ios'));
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('another');

    expect(container).toSnapshot();
  });

  it('does not render framework selection modal if vanilla js is NOT selected', async function () {
    const {organization} = initializeOrg({
      organization: {
        features: ['onboarding-sdk-selection'],
      },
    });

    const frameWorkModalMockRequests = renderFrameworkModalMockRequests({
      organization,
      teamSlug: teamWithAccess.slug,
    });

    TeamStore.loadUserTeams([teamWithAccess]);
    OrganizationStore.onUpdate(organization, {replace: true});

    render(<CreateProject />, {
      organization,
    });

    // Select the React platform
    await userEvent.click(screen.getByTestId('platform-javascript-react'));

    await userEvent.type(screen.getByLabelText('Select a Team'), 'test');
    await userEvent.click(screen.getByText('#test'));

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Create Project'})).toBeEnabled();
    });

    renderGlobalModal();

    // Click on 'configure SDK' button
    await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));

    // Modal shall not be open
    expect(screen.queryByText('Do you use a framework?')).not.toBeInTheDocument();

    expect(frameWorkModalMockRequests.projectCreationMockRequest).toHaveBeenCalled();
  });

  it('renders framework selection modal if vanilla js is selected', async function () {
    const {organization} = initializeOrg({
      organization: {
        features: ['onboarding-sdk-selection'],
      },
    });

    const frameWorkModalMockRequests = renderFrameworkModalMockRequests({
      organization,
      teamSlug: teamWithAccess.slug,
    });

    TeamStore.loadUserTeams([teamWithAccess]);
    OrganizationStore.onUpdate(organization, {replace: true});

    render(<CreateProject />, {
      organization,
    });

    // Select the JavaScript platform
    await userEvent.click(screen.getByTestId('platform-javascript'));

    await userEvent.type(screen.getByLabelText('Select a Team'), 'test');
    await userEvent.click(screen.getByText('#test'));

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Create Project'})).toBeEnabled();
    });

    renderGlobalModal();

    // Click on 'configure SDK' button
    await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));

    // Modal is open
    await screen.findByText('Do you use a framework?');

    // Close modal
    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));

    expect(frameWorkModalMockRequests.projectCreationMockRequest).not.toHaveBeenCalled();
  });

  describe('Issue Alerts Options', function () {
    const organization = TestStubs.Organization();
    beforeEach(() => {
      TeamStore.loadUserTeams([teamWithAccess]);

      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/rule-conditions/`,
        // @ts-ignore TODO: fix this type
        body: TestStubs.MOCK_RESP_VERBOSE,
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
    });

    it('should enabled the submit button if and only if all the required information has been filled', async function () {
      render(<CreateProject />);

      const createProjectButton = screen.getByRole('button', {name: 'Create Project'});

      await userEvent.click(screen.getByText(/When there are more than/));
      expect(createProjectButton).toBeDisabled();

      await userEvent.type(screen.getByTestId('range-input'), '2');
      expect(screen.getByTestId('range-input')).toHaveValue(2);
      expect(createProjectButton).toBeDisabled();

      await userEvent.click(screen.getByTestId('platform-apple-ios'));
      expect(createProjectButton).toBeEnabled();

      await userEvent.clear(screen.getByTestId('range-input'));
      expect(createProjectButton).toBeDisabled();

      await userEvent.type(screen.getByTestId('range-input'), '2712');
      expect(createProjectButton).toBeEnabled();

      await userEvent.clear(screen.getByTestId('range-input'));
      expect(createProjectButton).toBeDisabled();

      await userEvent.click(screen.getByText("I'll create my own alerts later"));
      expect(createProjectButton).toBeEnabled();
    });
  });
});
