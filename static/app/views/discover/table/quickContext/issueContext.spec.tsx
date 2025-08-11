import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {GroupStatus} from 'sentry/types/group';
import type {EventData} from 'sentry/utils/discover/eventView';

import IssueContext from './issueContext';
import {defaultRow} from './testUtils';

const mockedGroup = GroupFixture({
  id: '3512441874',
  project: ProjectFixture({
    id: '1',
    slug: 'cool-team',
  }),
  status: GroupStatus.IGNORED,
  assignedTo: {
    id: '12312',
    name: 'ingest',
    type: 'team',
  },
  count: '2500000',
  userCount: 64000,
  title: 'typeError: error description',
});

const renderIssueContext = (dataRow: EventData = defaultRow) => {
  const organization = OrganizationFixture();
  render(<IssueContext dataRow={dataRow} organization={organization} />, {organization});
};

describe('Quick Context Content Issue Column', function () {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/3512441874/',
      method: 'GET',
      body: mockedGroup,
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('Renders ignored issue status context', async () => {
    renderIssueContext();

    expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Ignored/i)).toBeInTheDocument();
    expect(screen.getByTestId('quick-context-ignored-icon')).toBeInTheDocument();
  });

  it('Renders resolved issue status context', async () => {
    const group = {...mockedGroup, status: GroupStatus.RESOLVED};
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/3512441874/',
      method: 'GET',
      body: group,
    });
    renderIssueContext();

    expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Resolved/i)).toBeInTheDocument();
    expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
  });

  it('Renders unresolved issue status context', async () => {
    const group = {...mockedGroup, status: GroupStatus.UNRESOLVED};
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/3512441874/',
      method: 'GET',
      body: group,
    });

    renderIssueContext();

    expect(await screen.findByText(/Issue Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Unresolved/i)).toBeInTheDocument();
    expect(screen.getByTestId('quick-context-unresolved-icon')).toBeInTheDocument();
  });

  it('Renders event and user counts', async () => {
    renderIssueContext();

    expect(await screen.findByText(/Events/i)).toBeInTheDocument();
    expect(screen.getByText(/2.5m/i)).toBeInTheDocument();
    expect(screen.getByText(/Users/i)).toBeInTheDocument();
    expect(screen.getByText(/64k/i)).toBeInTheDocument();
  });

  it('Renders assigned to context', async () => {
    renderIssueContext();

    expect(await screen.findByText(/Assigned To/i)).toBeInTheDocument();
    expect(screen.getByText(/#ingest/i)).toBeInTheDocument();
  });

  it('Renders title', async () => {
    renderIssueContext();

    expect(await screen.findByText(/Title/i)).toBeInTheDocument();
    expect(screen.getByText(/typeError: error description/i)).toBeInTheDocument();
  });
});
