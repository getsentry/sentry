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
  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/spans/fields/environment/values/`,
    body: [
      {
        key: 'prod',
        name: 'prod',
      },
      {
        key: 'dev',
        name: 'dev',
      },
    ],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/recent-searches/',
    method: 'POST',
    body: [],
  });
}

describe('Metrics Extraction Rule Form', function () {
  it('by focusing on the "select span attribute" field, the UI shall display a hint about custom attribute', async function () {
    const {project, organization} = initializeOrg();

    renderMockRequests({orgSlug: organization.slug, projectId: project.id});

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
    const {project, organization} = initializeOrg();

    renderMockRequests({orgSlug: organization.slug, projectId: project.id});

    render(
      <MetricsExtractionRuleForm initialData={INITIAL_DATA} projectId={project.id} />
    );

    await userEvent.click(screen.getByLabelText('Select tags'));

    expect(screen.getByText(/See how to instrument a custom tag/)).toHaveAttribute(
      'href',
      'https://docs.sentry.io/product/explore/metrics/metrics-set-up/'
    );
  });

  it('When creating a new metric and selecting a custom attribute, an alert should prompt to remember to instrument it', async function () {
    const {project, organization} = initializeOrg();

    renderMockRequests({orgSlug: organization.slug, projectId: project.id});

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

  it('When editing a metric and updating the form, an alert should prompt to remember it applies only for future data.', async function () {
    const {project, organization} = initializeOrg();

    renderMockRequests({orgSlug: organization.slug, projectId: project.id});

    render(
      <MetricsExtractionRuleForm
        initialData={INITIAL_DATA}
        projectId={project.id}
        isEdit
      />
    );

    await selectEvent.select(screen.getByText('none'), 'days');

    expect(screen.getByText(/only be reflected on future data/)).toBeInTheDocument();
  });

  it('Do not allow duplicated filters', async function () {
    const {project, organization} = initializeOrg();

    renderMockRequests({orgSlug: organization.slug, projectId: project.id});

    render(
      <MetricsExtractionRuleForm
        initialData={INITIAL_DATA}
        projectId={project.id}
        onSubmit={jest.fn()}
      />
    );

    await selectEvent.select(screen.getByText('Select span attribute'), 'user.id');

    await userEvent.click(screen.getByText('Add Filter'));
    await userEvent.click(screen.getByText('Save Changes'));
    expect(screen.getByText(/duplicates are not allowed/)).toBeInTheDocument();

    await userEvent.type(
      screen.getAllByPlaceholderText('Add span attributes')[0],
      'environment:prod{enter}'
    );
    await userEvent.type(
      screen.getAllByPlaceholderText('Add span attributes')[1],
      'environment:prod{enter}'
    );
    await userEvent.click(screen.getByText('Save Changes'));
    expect(screen.getByText(/duplicates are not allowed/)).toBeInTheDocument();

    await userEvent.type(
      screen.getAllByPlaceholderText('Add span attributes')[1],
      'environment:dev{enter}'
    );
    expect(screen.queryByText(/duplicates are not allowed/)).not.toBeInTheDocument();
  });
});
