import {GitHubIntegrationConfigFixture} from 'sentry-fixture/integrationListDirectory';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import ProjectOwnership from 'sentry/views/settings/project/projectOwnership';

jest.mock('sentry/actionCreators/modal');

describe('Project Ownership', () => {
  const {organization, project, routerProps} = initializeOrg();

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
    it('renders', () => {
      render(
        <ProjectOwnership
          {...routerProps}
          params={{projectId: project.slug}}
          organization={organization}
          project={project}
        />
      );
      // Does not render codeowners for orgs without 'integrations-codeowners' feature
      expect(
        screen.queryByRole('button', {name: 'Add CODEOWNERS'})
      ).not.toBeInTheDocument();
    });

    it('renders allows users to edit ownership rules', () => {
      render(
        <ProjectOwnership
          {...routerProps}
          params={{projectId: project.slug}}
          organization={organization}
          project={project}
        />,
        {organization: OrganizationFixture({access: ['project:read']})}
      );

      expect(screen.queryByRole('button', {name: 'Edit Rules'})).toBeEnabled();
      expect(screen.getByTestId('project-permission-alert')).toBeInTheDocument();
      // eslint-disable-next-line jest-dom/prefer-in-document
      expect(screen.getAllByTestId('project-permission-alert')).toHaveLength(1);
    });
  });

  describe('with codeowners', () => {
    it('codeowners button opens modal', async () => {
      const org = OrganizationFixture({
        features: ['integrations-codeowners'],
        access: ['org:integrations'],
      });
      render(
        <ProjectOwnership
          {...routerProps}
          params={{projectId: project.slug}}
          organization={org}
          project={project}
        />,
        {context: RouterContextFixture([{organization: org}])}
      );

      // Renders button
      expect(screen.getByRole('button', {name: 'Import CODEOWNERS'})).toBeInTheDocument();

      // Opens modal
      await userEvent.click(screen.getByRole('button', {name: 'Import CODEOWNERS'}));
      expect(openModal).toHaveBeenCalled();
    });
  });

  describe('issue owners settings', () => {
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

      render(
        <ProjectOwnership
          {...routerProps}
          params={{projectId: project.slug}}
          organization={organization}
          project={project}
        />
      );

      // Switch to Assign To Issue Owner
      await userEvent.click(screen.getByText('Auto-assign to suspect commits'));
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
  });
});
