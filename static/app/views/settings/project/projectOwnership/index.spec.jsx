import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import ProjectOwnership from 'sentry/views/settings/project/projectOwnership';

jest.mock('sentry/actionCreators/modal');

describe('Project Ownership', () => {
  let org = TestStubs.Organization();
  const project = TestStubs.ProjectDetails();

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/ownership/`,
      method: 'GET',
      body: {
        fallthrough: false,
        autoAssignment: 'Auto Assign to Suspect Commits',
        codeownersAutoSync: false,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/code-mappings/`,
      query: {project: project.id},
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/integrations/`,
      query: {features: 'codeowners'},
      method: 'GET',
      body: [TestStubs.GitHubIntegrationConfig()],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/codeowners/`,
      features: {expand: 'codeMapping'},
      method: 'GET',
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  describe('without codeowners', () => {
    it('renders', () => {
      const wrapper = render(
        <ProjectOwnership
          params={{orgId: org.slug, projectId: project.slug}}
          organization={org}
          project={project}
        />
      );
      expect(wrapper.container).toSnapshot();
      // Does not render codeowners for orgs without 'integrations-codeowners' feature
      expect(
        screen.queryByRole('button', {name: 'Add CODEOWNERS'})
      ).not.toBeInTheDocument();
    });
  });

  describe('with codeowners', () => {
    it('codeowners button opens modal', () => {
      org = TestStubs.Organization({
        features: ['integrations-codeowners'],
        access: ['org:integrations'],
      });
      render(
        <ProjectOwnership
          params={{orgId: org.slug, projectId: project.slug}}
          organization={org}
          project={project}
        />,
        {context: TestStubs.routerContext([{organization: org}])}
      );

      // Renders button
      expect(screen.getByRole('button', {name: 'Add CODEOWNERS'})).toBeInTheDocument();

      // Opens modal
      userEvent.click(screen.getByRole('button', {name: 'Add CODEOWNERS'}));
      expect(openModal).toHaveBeenCalled();
    });
  });

  describe('issue owners settings', () => {
    it('should set autoAssignment with commit-context string', async () => {
      const updateOwnership = MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/ownership/`,
        method: 'PUT',
        body: {
          fallthrough: false,
          autoAssignment: 'Assign To Issue Owner',
          codeownersAutoSync: false,
        },
      });

      render(
        <ProjectOwnership
          params={{orgId: org.slug, projectId: project.slug}}
          organization={org}
          project={project}
        />
      );

      // Switch to Assign To Issue Owner
      userEvent.click(screen.getByText('Auto-assign to suspect commits'));
      userEvent.click(screen.getByText('Auto-assign to issue owner'));

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
