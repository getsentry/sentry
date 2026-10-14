import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import InvestigationDetailView from 'sentry/views/investigations/detail';
import {
  InvestigationCommentFixture,
  InvestigationDetailFixture,
} from 'sentry/views/investigations/fixtures';

const organization = OrganizationFixture({
  features: ['investigations'],
  openMembership: true,
});
const detailUrl = '/organizations/org-slug/investigations/investigation-1/';
const commentsUrl = `${detailUrl}comments/`;
const initialRouterConfig = {
  location: {
    pathname: '/organizations/org-slug/explore/investigations/investigation-1/',
  },
  route: '/organizations/:orgId/explore/investigations/:investigationId/',
};

function renderPage() {
  return render(<InvestigationDetailView />, {organization, initialRouterConfig});
}

function findActivity() {
  return screen.findByRole('list', {name: 'Activity'});
}

describe('InvestigationActivity', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({url: detailUrl, body: InvestigationDetailFixture()});
    MockApiClient.addMockResponse({
      url: `${detailUrl}presence/`,
      method: 'PUT',
      body: {viewers: [], total: 0, heartbeatIntervalMs: 5000},
    });
  });

  it('lists comments newest first, then the creation', async () => {
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [
        InvestigationCommentFixture({
          id: '2',
          body: 'Second',
          blockId: 'block-2',
          author: null,
        }),
        InvestigationCommentFixture({id: '1', body: 'First'}),
      ],
    });
    renderPage();

    const activity = await findActivity();
    const items = within(activity).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Second');
    expect(within(items[0]!).getByText('Unknown user commented')).toBeInTheDocument();
    expect(within(items[0]!).getByText('on Latency query')).toBeInTheDocument();
    expect(items[1]).toHaveTextContent('First');
    expect(within(items[1]!).getByText('Ada Lovelace commented')).toBeInTheDocument();
    expect(items[2]).toHaveTextContent('Investigation first created');
  });

  it('notes when older comments are not shown', async () => {
    MockApiClient.addMockResponse({
      url: commentsUrl,
      body: [InvestigationCommentFixture()],
      headers: {
        Link: `<${commentsUrl}?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"`,
      },
    });
    renderPage();

    expect(
      within(await findActivity()).getByText('Showing the latest 100 comments.')
    ).toBeInTheDocument();
  });
});
