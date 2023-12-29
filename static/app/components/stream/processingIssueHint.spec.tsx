import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProcessingIssueHint from 'sentry/components/stream/processingIssueHint';

describe('ProcessingIssueHint', function () {
  let issue, container;
  const orgId = 'test-org';
  const projectId = 'test-project';

  beforeEach(() => {
    issue = {
      hasIssues: false,
      hasMoreResolveableIssues: false,
      issuesProcessing: 0,
      lastSeen: '2019-01-16T15:38:38Z',
      numIssues: 0,
      resolveableIssues: 0,
      signedLink: null,
    };
  });

  function renderComponent(issueData, showProject = false) {
    const result = render(
      <ProcessingIssueHint
        issue={issueData}
        orgId={orgId}
        projectId={projectId}
        showProject={showProject}
      />,
      {context: RouterContextFixture()}
    );
    container = result.container;
  }

  describe('numIssues state', function () {
    beforeEach(() => {
      issue.numIssues = 9;
    });

    it('displays a button', function () {
      renderComponent(issue);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute(
        'href',
        `/settings/${orgId}/projects/${projectId}/processing-issues/`
      );
    });

    it('displays an icon', function () {
      renderComponent(issue);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('displays text', function () {
      renderComponent(issue);
      expect(screen.getByText(/issues blocking/)).toBeInTheDocument();
    });
  });

  describe('issuesProcessing state', function () {
    beforeEach(() => {
      issue.issuesProcessing = 9;
    });

    it('does not display a button', function () {
      renderComponent(issue);
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('displays an icon', function () {
      renderComponent(issue);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('displays text', function () {
      renderComponent(issue);
      expect(screen.getByText(/Reprocessing/)).toBeInTheDocument();
    });
  });

  describe('resolvableIssues state', function () {
    beforeEach(() => {
      issue.resolveableIssues = 9;
    });

    it('displays a button', function () {
      renderComponent(issue);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveAttribute(
        'href',
        `/settings/${orgId}/projects/${projectId}/processing-issues/`
      );
    });

    it('displays an icon', function () {
      renderComponent(issue);
      const icon = container.querySelector('svg');
      expect(icon).toBeInTheDocument();
    });

    it('displays text', function () {
      renderComponent(issue);
      expect(
        screen.getByText('There are 9 events pending reprocessing.')
      ).toBeInTheDocument();
    });
  });

  describe('showProject state', function () {
    beforeEach(() => {
      issue.numIssues = 9;
    });
    it('displays the project slug', function () {
      renderComponent(issue, true);
      expect(screen.getByText(projectId)).toBeInTheDocument();
    });
  });
});
