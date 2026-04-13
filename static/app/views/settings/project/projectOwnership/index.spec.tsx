import {GitHubIntegrationConfigFixture} from 'sentry-fixture/integrationListDirectory';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import ProjectOwnership from 'sentry/views/settings/project/projectOwnership';

jest.mock('sentry/actionCreators/modal');

describe('Project Ownership', () => {
  const {organization, project} = initializeOrg();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/ownership/`,
      method: 'GET',
      body: {
        fallthrough: false,
        autoAssignment: 'Auto Assign to Suspect Commits',
        codeownersAutoSync: false,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/code-mappings/?project=${project.id}`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/?features=codeowners`,
      method: 'GET',
      body: [GitHubIntegrationConfigFixture()],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/codeowners/`,
      method: 'GET',
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('without codeowners', () => {
    it('renders', async () => {
      render(<ProjectOwnership />, {
        organization,
        outletContext: {project},
      });
      expect(await screen.findByText('No ownership rules found')).toBeInTheDocument();
      // Does not render codeowners for orgs without 'integrations-codeowners' feature
      expect(
        screen.queryByRole('button', {name: 'Add CODEOWNERS'})
      ).not.toBeInTheDocument();
    });

    it('renders allows users to edit ownership rules', async () => {
      render(<ProjectOwnership />, {
        organization: OrganizationFixture({access: ['project:read']}),
        outletContext: {project},
      });

      expect(await screen.findByTestId('project-permission-alert')).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Edit Rules'})).toBeEnabled();

      expect(screen.getAllByTestId('project-permission-alert')).toHaveLength(1);
    });
  });

  describe('with codeowners', () => {
    it('codeowners button opens modal', async () => {
      const org = OrganizationFixture({
        features: ['integrations-codeowners'],
        access: ['org:integrations'],
      });
      render(<ProjectOwnership />, {
        organization: org,
        outletContext: {project},
      });

      // Renders button
      expect(
        await screen.findByRole('button', {name: 'Import CODEOWNERS'})
      ).toBeInTheDocument();

      // Opens modal
      await userEvent.click(screen.getByRole('button', {name: 'Import CODEOWNERS'}));
      expect(openModal).toHaveBeenCalled();
    });
  });

  describe('issue owners settings', () => {
    it('renders autoAssignment select field with correct initial value', async () => {
      render(<ProjectOwnership />, {
        organization,
        outletContext: {project},
      });

      expect(
        await screen.findByText('Auto-assign to suspect commits')
      ).toBeInTheDocument();
    });

    it('renders Sync changes from CODEOWNERS field', async () => {
      render(<ProjectOwnership />, {
        organization,
        outletContext: {project},
      });

      expect(await screen.findByText('Sync changes from CODEOWNERS')).toBeInTheDocument();
    });

    it('should set autoAssignment with commit-context string', async () => {
      const updateOwnership = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/ownership/`,
        method: 'PUT',
        body: {
          fallthrough: false,
          autoAssignment: 'Assign To Issue Owner',
          codeownersAutoSync: false,
        },
      });

      render(<ProjectOwnership />, {
        organization,
        outletContext: {project},
      });

      // Switch to Assign To Issue Owner
      await userEvent.click(await screen.findByText('Auto-assign to suspect commits'));
      await userEvent.click(screen.getByText('Auto-assign to issue owner'));

      await waitFor(() => {
        expect(updateOwnership).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            data: {
              autoAssignment: 'Auto Assign to Issue Owner',
            },
          })
        );
      });
    });

    it('disables autoAssignment select when user lacks write access', async () => {
      render(<ProjectOwnership />, {
        organization: OrganizationFixture({access: ['project:read']}),
        outletContext: {project: ProjectFixture({access: []})},
      });

      // Wait for the autoAssignment field to render
      const autoAssignText = await screen.findByText('Auto-assign to suspect commits');
      expect(autoAssignText).toBeInTheDocument();

      // The select input should be disabled - find the textbox closest to the label
      const selectInput = autoAssignText
        .closest('[class*="container"]')
        ?.querySelector('input');
      expect(selectInput).toBeDisabled();
    });

    it('disables codeownersAutoSync when no codeowners exist', async () => {
      render(<ProjectOwnership />, {
        organization,
        outletContext: {project},
      });

      // Wait for the page to load
      expect(await screen.findByText('Sync changes from CODEOWNERS')).toBeInTheDocument();

      // The switch should be disabled since no codeowners exist (codeowners returns [])
      const switchEl = screen.getByRole('checkbox', {
        name: /sync changes from codeowners/i,
      });
      expect(switchEl).toBeDisabled();
    });
  });
});
