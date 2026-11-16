import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TelemetryClassifierFixture} from 'sentry-fixture/telemetryClassifier';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import ClassifiersList from './list';
import type {TelemetryClassifier} from './types';

const NEXT_PAGE_LINKS =
  '<https://sentry.io/next/>; rel="previous"; results="false"; cursor="0:0:1", ' +
  '<https://sentry.io/next/>; rel="next"; results="true"; cursor="0:25:0"';

describe('ClassifiersList', () => {
  const organization = OrganizationFixture({features: ['classifiers-ui']});
  const classifiersUrl = `/organizations/${organization.slug}/classifiers/`;
  const path = `/organizations/${organization.slug}/seer/classifiers/`;

  function renderList(query: Record<string, string> = {}) {
    return render(<ClassifiersList />, {
      organization,
      initialRouterConfig: {
        location: {pathname: path, query},
        route: '/organizations/:orgId/seer/classifiers/',
      },
    });
  }

  function mockClassifiers(classifiers: TelemetryClassifier[], headers = {}) {
    return MockApiClient.addMockResponse({
      url: classifiersUrl,
      body: classifiers,
      headers,
    });
  }

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'frontend', isMember: true}),
      ProjectFixture({id: '2', slug: 'backend', isMember: true}),
    ]);
  });

  it('renders the classifiers returned by the API', async () => {
    mockClassifiers([
      TelemetryClassifierFixture({id: '10', projectId: '1'}),
      TelemetryClassifierFixture({
        id: '11',
        projectId: '2',
        name: 'Slow spans',
        resultAttribute: 'slow_spans',
        dataset: 'trace_spans',
      }),
    ]);

    renderList();

    const conversationRow = (
      await screen.findByRole('link', {name: 'User frustration'})
    ).closest('tr')!;
    expect(within(conversationRow).getByText('frontend')).toBeInTheDocument();
    expect(
      within(conversationRow).getByText('sentry.enrichment.user_frustration')
    ).toBeInTheDocument();
    expect(within(conversationRow).getByText('Conversations')).toBeInTheDocument();

    const spanRow = screen.getByRole('link', {name: 'Slow spans'}).closest('tr')!;
    expect(within(spanRow).getByText('backend')).toBeInTheDocument();
    expect(within(spanRow).getByText('sentry.enrichment.slow_spans')).toBeInTheDocument();
    expect(within(spanRow).getByText('Spans')).toBeInTheDocument();
  });

  it('links each classifier to its detail page', async () => {
    mockClassifiers([TelemetryClassifierFixture({id: '10'})]);

    renderList();

    expect(await screen.findByRole('link', {name: 'User frustration'})).toHaveAttribute(
      'href',
      `${path}10/`
    );
  });

  it('marks disabled classifiers', async () => {
    mockClassifiers([
      TelemetryClassifierFixture({id: '10', status: 'disabled'}),
      TelemetryClassifierFixture({id: '11', name: 'Tool failure'}),
    ]);

    renderList();

    expect(await screen.findByText('Disabled')).toBeInTheDocument();
    expect(
      within(screen.getByRole('link', {name: 'Tool failure'}).closest('tr')!).queryByText(
        'Disabled'
      )
    ).not.toBeInTheDocument();
  });

  it('resets the cursor when the project selection changes', async () => {
    mockClassifiers([TelemetryClassifierFixture()]);

    const {router} = renderList({cursor: '0:25:0'});

    await userEvent.click(await screen.findByTestId('page-filter-project-selector'));
    await userEvent.click(await screen.findByRole('row', {name: 'backend'}));

    await waitFor(() => expect(router.location.query.project).toBe('2'));
    expect(router.location.query.cursor).toBeUndefined();
  });

  it('requests the selected projects and the current cursor', async () => {
    const request = mockClassifiers([TelemetryClassifierFixture()]);

    renderList({project: '2', cursor: '0:25:0'});

    await screen.findByRole('link', {name: 'User frustration'});
    expect(request).toHaveBeenCalledWith(
      classifiersUrl,
      expect.objectContaining({
        query: expect.objectContaining({project: [2], cursor: '0:25:0', per_page: 25}),
      })
    );
  });

  it('moves to the next page with the pagination controls', async () => {
    mockClassifiers([TelemetryClassifierFixture()], {Link: NEXT_PAGE_LINKS});

    const {router} = renderList();

    await userEvent.click(await screen.findByRole('button', {name: 'Next'}));

    expect(router.location.query.cursor).toBe('0:25:0');
  });

  it('shows an empty state without classifiers', async () => {
    mockClassifiers([]);

    renderList();

    expect(await screen.findByText('No classifiers found.')).toBeInTheDocument();
  });

  it('shows an error state when the request fails', async () => {
    MockApiClient.addMockResponse({url: classifiersUrl, statusCode: 500, body: {}});

    renderList();

    expect(await screen.findByText('Error loading classifiers')).toBeInTheDocument();
  });

  it('opens the create flow for the chosen dataset', async () => {
    mockClassifiers([TelemetryClassifierFixture()]);

    renderList();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Create New Classifier'})
    );

    expect(
      await screen.findByRole('menuitemradio', {name: 'Classifier on conversations'})
    ).toHaveAttribute('href', `${path}new/?dataset=conversation`);
    expect(
      screen.getByRole('menuitemradio', {name: 'Classifier on spans'})
    ).toHaveAttribute('href', `${path}new/?dataset=trace_spans`);
  });
});
