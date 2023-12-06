import {Organization} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProcessingIssueList from 'sentry/components/stream/processingIssueList';

describe('ProcessingIssueList', function () {
  let projects, organization, fetchIssueRequest;

  beforeEach(function () {
    fetchIssueRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/processingissues/',
      method: 'GET',
      body: [
        {
          project: 'test-project',
          numIssues: 1,
          hasIssues: true,
          lastSeen: '2019-01-16T15:39:11.081Z',
        },
        {
          project: 'other-project',
          numIssues: 1,
          hasIssues: true,
          lastSeen: '2019-01-16T15:39:11.081Z',
        },
      ],
    });
    organization = Organization();
    projects = [1, 2];
  });

  describe('componentDidMount', function () {
    it('fetches issues', async function () {
      render(<ProcessingIssueList organization={organization} projectIds={projects} />);
      await screen.findAllByText('Show details');

      expect(fetchIssueRequest).toHaveBeenCalled();
    });
  });

  describe('render', function () {
    it('renders multiple issues', async function () {
      render(<ProcessingIssueList organization={organization} projectIds={projects} />);
      const items = await screen.findAllByText(/There is 1 issue blocking/);
      expect(items).toHaveLength(2);
    });

    it('forwards the showProject prop', async function () {
      render(
        <ProcessingIssueList
          organization={organization}
          showProject
          projectIds={projects}
        />
      );
      const projectText = await screen.findByText(/test-project/);
      expect(projectText).toBeInTheDocument();

      const otherProject = screen.getByText(/other-project/);
      expect(otherProject).toBeInTheDocument();
    });
  });
});
