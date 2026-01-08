import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  makeClosableHeader,
  makeCloseButton,
  ModalBody,
  ModalFooter,
} from 'sentry/components/globalModal/components';
import ProjectsStore from 'sentry/stores/projectsStore';
import {CreateIssueViewModal} from 'sentry/views/issueList/issueViews/createIssueViewModal';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

describe('CreateIssueViewModal', () => {
  const defaultProps = {
    Body: ModalBody,
    Header: makeClosableHeader(jest.fn()),
    Footer: ModalFooter,
    CloseButton: makeCloseButton(jest.fn()),
    closeModal: jest.fn(),
    projects: [2],
    environments: ['env2'],
    timeFilters: {
      period: '30d',
      start: null,
      end: null,
      utc: null,
    },
    query: 'is:unresolved foo',
    querySort: IssueSortOptions.TRENDS,
    starred: false,
    analyticsSurface: 'issue-views-list' as const,
  };

  it('can create a new view', async () => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'project-1', environments: ['env1']}),
      ProjectFixture({id: '2', slug: 'project-2', environments: ['env2']}),
      ProjectFixture({id: '3', slug: 'project-3', environments: ['env3']}),
    ]);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    const mockCreateViewEndpoint = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/',
      method: 'POST',
      body: GroupSearchViewFixture({
        id: '3',
        name: 'foo',
        projects: [2],
        environments: ['env2'],
        timeFilters: {
          period: '30d',
          start: null,
          end: null,
          utc: null,
        },
      }),
    });

    const {router} = render(<CreateIssueViewModal {...defaultProps} />, {
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/issues/views/',
        },
      },
    });

    const nameInput = screen.getByRole('textbox', {name: 'Name'});
    await userEvent.type(nameInput, 'foo');

    await userEvent.click(screen.getByRole('button', {name: 'Create View'}));

    // When done should redirect to the new view
    await waitFor(() => {
      expect(router.location.pathname).toBe('/organizations/org-slug/issues/views/3/');
    });

    expect(mockCreateViewEndpoint).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          name: 'foo',
          projects: [2],
          environments: ['env2'],
          timeFilters: {
            period: '30d',
            start: null,
            end: null,
            utc: null,
          },
          query: 'is:unresolved foo',
          querySort: IssueSortOptions.TRENDS,
          starred: true,
        },
      })
    );
  }, 10_000);

  describe('AI title generation', () => {
    const aiTitleProps = {
      Body: ModalBody,
      Header: makeClosableHeader(jest.fn()),
      Footer: ModalFooter,
      CloseButton: makeCloseButton(jest.fn()),
      closeModal: jest.fn(),
      analyticsSurface: 'issues-feed' as const,
    };

    it('generates title when feature flag is enabled and query exists', async () => {
      const mockGenerateTitle = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issue-view-title/generate/',
        method: 'POST',
        body: {title: 'My Unresolved Errors'},
      });

      const organization = OrganizationFixture({
        features: ['issue-view-ai-title'],
      });

      render(
        <CreateIssueViewModal {...aiTitleProps} query="is:unresolved level:error" />,
        {
          organization,
        }
      );

      await waitFor(() => {
        expect(mockGenerateTitle).toHaveBeenCalledWith(
          '/organizations/org-slug/issue-view-title/generate/',
          expect.objectContaining({
            method: 'POST',
            data: {query: 'is:unresolved level:error'},
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByRole('textbox', {name: 'Name'})).toHaveValue(
          'My Unresolved Errors'
        );
      });
    });

    it('does not generate title when feature flag is disabled', () => {
      const mockGenerateTitle = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issue-view-title/generate/',
        method: 'POST',
        body: {title: 'Generated Title'},
      });

      const organization = OrganizationFixture({
        features: [],
      });

      render(<CreateIssueViewModal {...aiTitleProps} query="is:unresolved" />, {
        organization,
      });

      expect(mockGenerateTitle).not.toHaveBeenCalled();
    });

    it('does not generate title when no query is provided', () => {
      const mockGenerateTitle = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issue-view-title/generate/',
        method: 'POST',
        body: {title: 'Generated Title'},
      });

      const organization = OrganizationFixture({
        features: ['issue-view-ai-title'],
      });

      render(<CreateIssueViewModal {...aiTitleProps} />, {organization});

      expect(mockGenerateTitle).not.toHaveBeenCalled();
    });

    it('uses incoming name when provided and feature flag disabled', () => {
      const organization = OrganizationFixture({
        features: [],
      });

      render(<CreateIssueViewModal {...aiTitleProps} name="My Custom View" />, {
        organization,
      });

      expect(screen.getByRole('textbox', {name: 'Name'})).toHaveValue('My Custom View');
    });

    it('prefers generated name over incoming name', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issue-view-title/generate/',
        method: 'POST',
        body: {title: 'AI Generated Title'},
      });

      const organization = OrganizationFixture({
        features: ['issue-view-ai-title'],
      });

      render(
        <CreateIssueViewModal
          {...aiTitleProps}
          query="is:unresolved"
          name="Incoming Name"
        />,
        {organization}
      );

      await waitFor(() => {
        expect(screen.getByRole('textbox', {name: 'Name'})).toHaveValue(
          'AI Generated Title'
        );
      });
    });
  });
});
