import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {INITIAL_DATA} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleCreateModal';
import {MetricsExtractionRuleForm} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleForm';

function renderMockRequests({orgSlug, projectId}: {orgSlug: string; projectId: string}) {
  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/spans/fields/`,
    body: [],
  });
  MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${projectId}/metrics/extraction-rules/`,
    method: 'GET',
    body: [
      {
        aggregates: ['count'],
        conditions: [{id: 102, value: '', mris: ['c:custom/span_attribute_102@none']}],
        createdById: 3142223,
        dateAdded: '2024-07-29T12:04:23.196785Z',
        dateUpdated: '2024-07-29T12:04:23.197008Z',
        projectId,
        spanAttribute: 'A',
        tags: ['release', 'environment'],
        unit: 'none',
      },
    ],
  });
}

describe('Metrics Extraction Rule Form', function () {
  it('by focusing on the "select span attribute" field, the UI shall display a hint about custom attribute', async function () {
    const {project} = initializeOrg();

    renderMockRequests({orgSlug: project.organization.slug, projectId: project.id});

    render(
      <MetricsExtractionRuleForm initialData={INITIAL_DATA} projectId={project.id} />
    );

    await userEvent.click(screen.getByText('Select span attribute'));

    expect(screen.getByText(/See how to instrument a custom attribute/)).toHaveAttribute(
      'href',
      'https://docs.sentry.io/product/explore/metrics/metrics-set-up/'
    );
  });

  it('by focusing on the "group and filter by" field, the UI shall display a hint about custom attribute', async function () {
    const {project} = initializeOrg();

    renderMockRequests({orgSlug: project.organization.slug, projectId: project.id});

    render(
      <MetricsExtractionRuleForm initialData={INITIAL_DATA} projectId={project.id} />
    );

    await userEvent.click(screen.getByLabelText('Select tags'));

    expect(screen.getByText(/See how to instrument a custom tag/)).toHaveAttribute(
      'href',
      'https://docs.sentry.io/product/explore/metrics/metrics-set-up/'
    );
  });

  it('by selecting a custom attribute the alert about delay in ingestion shall render different info', async function () {
    const {project} = initializeOrg();

    renderMockRequests({orgSlug: project.organization.slug, projectId: project.id});

    render(
      <MetricsExtractionRuleForm initialData={INITIAL_DATA} projectId={project.id} />
    );

    await userEvent.type(screen.getByText('Select span attribute'), 'new-metric');

    await userEvent.click(
      // the dom renders 2x of this text because of aria
      screen.getAllByText(textWithMarkupMatcher('Create "new-metric"'))[1]
    );

    expect(screen.getByText(/You want to track a custom attribute/)).toBeInTheDocument();

    await selectEvent.select(screen.getByText('new-metric'), 'browser.name');

    expect(
      screen.queryByText(/You want to track a custom attribute/)
    ).not.toBeInTheDocument();
  });
});
