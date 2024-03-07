import {Entries123Base, Entries123Target} from 'sentry-fixture/entries';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueDiff} from 'sentry/components/issueDiff';
import {trackAnalytics} from 'sentry/utils/analytics';

jest.mock('sentry/api');
jest.mock('sentry/utils/analytics');

describe('IssueDiff', function () {
  const entries123Target = Entries123Target();
  const entries123Base = Entries123Base();
  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const project = ProjectFixture({features: ['similarity-embeddings']});

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/issues/base/events/latest/',
      body: {
        eventID: '123base',
      },
    });
    MockApiClient.addMockResponse({
      url: '/issues/target/events/latest/',
      body: {
        eventID: '123target',
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/events/123target/`,
      body: {
        entries: entries123Target,
      },
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/events/123base/`,
      body: {
        platform: 'javascript',
        entries: entries123Base,
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('is loading when initially rendering', function () {
    render(
      <IssueDiff
        api={api}
        baseIssueId="base"
        targetIssueId="target"
        orgId="org-slug"
        project={project}
      />
    );
    expect(screen.queryByTestId('split-diff')).not.toBeInTheDocument();
  });

  it('can dynamically import SplitDiff', async function () {
    render(
      <IssueDiff
        api={api}
        baseIssueId="base"
        targetIssueId="target"
        orgId="org-slug"
        project={project}
        organization={organization}
        shouldBeGrouped="Yes"
      />
    );

    expect(await screen.findByTestId('split-diff')).toBeInTheDocument();
    expect(trackAnalytics).toHaveBeenCalled();
  });

  it('can diff message', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/events/123target/`,
      body: {
        entries: [{type: 'message', data: {formatted: 'Hello World'}}],
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/events/123base/`,
      body: {
        platform: 'javascript',
        entries: [{type: 'message', data: {formatted: 'Foo World'}}],
      },
    });

    render(
      <IssueDiff
        api={api}
        baseIssueId="base"
        targetIssueId="target"
        orgId="org-slug"
        project={project}
      />
    );

    expect(await screen.findByTestId('split-diff')).toBeInTheDocument();
  });
});
