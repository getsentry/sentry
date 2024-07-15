import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {MetricsExtractionRulesTable} from './metricsExtractionRulesTable';

describe('Metrics Extraction Rules Table', function () {
  const {project, organization} = initializeOrg();

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.id}/metrics/extraction-rules/`,
      method: 'GET',
      body: [
        {
          spanAttribute: 'span.duration',
          aggregates: [
            'count',
            'count_unique',
            'min',
            'max',
            'sum',
            'avg',
            'p50',
            'p75',
            'p95',
            'p99',
          ],
          unit: 'millisecond',
          tags: [
            'browser.name',
            'cache.hit',
            'environment',
            'http.response_content_length',
            'messaging.destination.name',
            'sdk.name',
            'resource.render_blocking_status',
            'release',
            'replay.id',
            'span.action',
            'span.category',
            'span.description',
            'span.group',
            'span.module',
            'span.domain',
            'span.status_code',
            'timestamp',
            'transaction.method',
            'transaction',
            'trace.status',
          ],
          conditions: [
            {
              id: 66,
              value: '',
              mris: [
                'c:custom/span_attribute_66@millisecond',
                's:custom/span_attribute_66@millisecond',
                'd:custom/span_attribute_66@millisecond',
                'g:custom/span_attribute_66@millisecond',
              ],
            },
          ],
          projectId: project.id,
          createdById: 3242858,
          dateAdded: '2024-07-17T07:06:33.253094Z',
          dateUpdated: '2024-07-17T21:27:54.742586Z',
        },
        {
          spanAttribute: 'browser.name',
          aggregates: [
            'count',
            'count_unique',
            'min',
            'max',
            'sum',
            'avg',
            'p50',
            'p75',
            'p95',
            'p99',
          ],
          unit: 'none',
          tags: [
            'release',
            'environment',
            'browser.name',
            'cache.hit',
            'http.response_content_length',
            'messaging.destination.name',
            'replay.id',
            'resource.render_blocking_status',
            'sdk.name',
            'raw_domain',
            'timestamp',
            'trace',
            'trace.status',
            'transaction',
            'project',
            'profile_id',
            'origin.transaction',
            'span.module',
            'span.op',
            'span.status',
          ],
          conditions: [
            {
              id: 67,
              value: '',
              mris: [
                'c:custom/span_attribute_67@none',
                's:custom/span_attribute_67@none',
                'd:custom/span_attribute_67@none',
                'g:custom/span_attribute_67@none',
              ],
            },
          ],
          projectId: project.id,
          createdById: 588685,
          dateAdded: '2024-07-17T21:32:15.297483Z',
          dateUpdated: '2024-07-17T21:33:41.060903Z',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/metrics/query/`,
      method: 'POST',
      body: {
        data: [
          [
            {
              by: {
                mri: 'c:custom/span_attribute_67@none',
              },
              totals: 2703.0,
              series: [
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                901.0,
                1802.0,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
              ],
            },
          ],
        ],
        meta: [
          [
            {
              name: 'aggregate_value',
              type: 'Float64',
            },
            {
              name: 'mri',
              type: 'String',
            },
            {
              group_bys: ['mri'],
              order: 'DESC',
              limit: 401,
              has_more: false,
              unit_family: null,
              unit: null,
              scaling_factor: null,
            },
          ],
        ],
        start: '2024-07-16T21:00:00Z',
        end: '2024-07-17T22:00:00Z',
        intervals: [
          '2024-07-16T21:00:00Z',
          '2024-07-16T22:00:00Z',
          '2024-07-16T23:00:00Z',
          '2024-07-17T00:00:00Z',
          '2024-07-17T01:00:00Z',
          '2024-07-17T02:00:00Z',
          '2024-07-17T03:00:00Z',
          '2024-07-17T04:00:00Z',
          '2024-07-17T05:00:00Z',
          '2024-07-17T06:00:00Z',
          '2024-07-17T07:00:00Z',
          '2024-07-17T08:00:00Z',
          '2024-07-17T09:00:00Z',
          '2024-07-17T10:00:00Z',
          '2024-07-17T11:00:00Z',
          '2024-07-17T12:00:00Z',
          '2024-07-17T13:00:00Z',
          '2024-07-17T14:00:00Z',
          '2024-07-17T15:00:00Z',
          '2024-07-17T16:00:00Z',
          '2024-07-17T17:00:00Z',
          '2024-07-17T18:00:00Z',
          '2024-07-17T19:00:00Z',
          '2024-07-17T20:00:00Z',
          '2024-07-17T21:00:00Z',
        ],
      },
    });
  });

  it('shall open the modal to edit a rule by clicking on edit', async function () {
    render(<MetricsExtractionRulesTable project={project} />);
    renderGlobalModal();

    const editButtons = await screen.findAllByLabelText('Edit metric');
    await userEvent.click(editButtons[1]);

    expect(
      await screen.findByRole('heading', {name: /span.duration/})
    ).toBeInTheDocument();
  });

  it('shall display cardinality limit warning', async function () {
    render(<MetricsExtractionRulesTable project={project} />);

    expect(
      await screen.findByLabelText('Exceeding the cardinality limit warning')
    ).toBeInTheDocument();
  });
});
