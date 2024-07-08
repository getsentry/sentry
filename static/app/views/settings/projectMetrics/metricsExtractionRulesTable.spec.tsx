import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import * as useNavigate from 'sentry/utils/useNavigate';

import {MetricsExtractionRulesTable} from './metricsExtractionRulesTable';

const MockNavigate = jest.fn();
jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: () => MockNavigate,
}));
describe('Metrics Extraction Rules Table', function () {
  const {router, project, organization} = initializeOrg();

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/metrics/extraction-rules/`,
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
      body: {data: []},
    });
  });

  it('shall open the modal to edit a rule by clicking on edit', async function () {
    jest.spyOn(useNavigate, 'useNavigate');

    render(<MetricsExtractionRulesTable project={project} />);

    const editButton = await screen.findByLabelText('Edit metric');
    await userEvent.click(editButton);

    expect(MockNavigate).toHaveBeenCalledWith(
      `/settings/projects/${project.slug}/metrics/span.duration/edit/`
    );
  });

  it('shall open the modal to edit a rule if edit path in URL', async function () {
    jest.spyOn(useNavigate, 'useNavigate');

    render(<MetricsExtractionRulesTable project={project} />, {
      router: {
        location: {
          ...router.location,
          pathname: `/settings/projects/${project.slug}/metrics/span.duration/edit/`,
        },
        params: {
          spanAttribute: 'span.duration',
        },
      },
    });

    renderGlobalModal();

    expect(
      await screen.findByRole('heading', {name: /span.duration/})
    ).toBeInTheDocument();
  });
});
