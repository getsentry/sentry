import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import type {MetricsExtractionRule} from 'sentry/types/metrics';

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
          projectId: Number(project.id),
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
          tags: ['release', 'environment', 'sdk.name', 'span.op'],
          conditions: [
            {
              id: 1,
              value: '',
              mris: [
                'g:custom/span_attribute_1@millisecond',
                's:custom/span_attribute_1@millisecond',
                'd:custom/span_attribute_1@millisecond',
                'c:custom/span_attribute_1@millisecond',
              ],
            },
          ],
        } satisfies MetricsExtractionRule,
      ],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spans/fields/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/metrics/query/`,
      method: 'POST',
      body: {data: []},
    });
  });

  it('shall open the modal to edit a rule by clicking on edit', async function () {
    render(<MetricsExtractionRulesTable project={project} />);
    renderGlobalModal();

    const editButton = await screen.findByLabelText('Edit metric');
    await userEvent.click(editButton);

    expect(
      await screen.findByRole('heading', {name: /span.duration/})
    ).toBeInTheDocument();
  });
});
