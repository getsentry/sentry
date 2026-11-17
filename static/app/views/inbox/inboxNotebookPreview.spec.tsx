import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {InvestigationDetailFixture} from 'sentry/views/investigations/fixtures';

import {InboxNotebookPreview} from './inboxNotebookPreview';

describe('InboxNotebookPreview', () => {
  const organization = OrganizationFixture({
    features: ['investigations'],
    openMembership: true,
  });
  const investigation = InvestigationDetailFixture();
  const detailUrl = `/organizations/${organization.slug}/notebooks/${investigation.id}/`;

  beforeEach(() => {
    MockApiClient.addMockResponse({url: detailUrl, body: investigation});
    MockApiClient.addMockResponse({url: `${detailUrl}comments/`, body: []});
    MockApiClient.addMockResponse({url: `${detailUrl}comment-counts/`, body: {}});
    MockApiClient.addMockResponse({
      url: `${detailUrl}presence/`,
      method: 'PUT',
      body: {viewers: [], total: 0, heartbeatIntervalMs: 5000},
    });
  });

  it('shows the investigation header, report, and activity', async () => {
    render(<InboxNotebookPreview investigationId={investigation.id} />, {organization});

    expect(await screen.findByRole('textbox', {name: 'Investigation title'})).toHaveValue(
      'Investigate database latency'
    );
    expect(screen.getByText('Manual investigation')).toBeInTheDocument();
    expect(screen.getByLabelText('Block actions for Summary')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Activity'})).toBeInTheDocument();
  });

  it("leaves the page's top bar alone", async () => {
    render(<InboxNotebookPreview investigationId={investigation.id} />, {organization});

    await screen.findByRole('textbox', {name: 'Investigation title'});

    expect(screen.queryByRole('link', {name: 'Investigations'})).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', {name: 'Investigate database latency'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Investigation actions'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Open investigation'})
    ).not.toBeInTheDocument();
  });

  it('shows an error when the investigation fails to load', async () => {
    MockApiClient.addMockResponse({url: detailUrl, statusCode: 404, body: {}});

    render(<InboxNotebookPreview investigationId={investigation.id} />, {organization});

    expect(await screen.findByRole('button', {name: 'Retry'})).toBeInTheDocument();
  });

  it('explains when investigations need open membership', () => {
    render(<InboxNotebookPreview investigationId={investigation.id} />, {
      organization: OrganizationFixture({
        features: ['investigations'],
        openMembership: false,
      }),
    });

    expect(
      screen.getByText(
        'Investigations are only available to organizations with open membership.'
      )
    ).toBeInTheDocument();
  });
});
