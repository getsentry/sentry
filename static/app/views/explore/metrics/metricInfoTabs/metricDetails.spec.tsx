import type {ReactNode} from 'react';
import qs from 'query-string';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {
  createTraceMetricFixtures,
  initializeTraceMetricsTest,
} from 'sentry-fixture/tracemetrics';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {QueryParamsContextProvider} from 'sentry/views/explore/queryParams/context';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';

import {MetricDetails} from './metricDetails';

function Wrapper({children}: {children: ReactNode}) {
  return (
    <QueryParamsContextProvider
      queryParams={
        new ReadableQueryParams({
          extrapolate: true,
          mode: Mode.SAMPLES,
          query: '',
          cursor: '',
          fields: [],
          sortBys: [],
          aggregateCursor: '',
          aggregateFields: [],
          aggregateSortBys: [],
        })
      }
      setQueryParams={() => {}}
      isUsingDefaultFields
      shouldManageFields={false}
    >
      <table>
        <tbody>{children}</tbody>
      </table>
    </QueryParamsContextProvider>
  );
}

describe('MetricDetails', () => {
  const {organization, project, setupPageFilters} = initializeTraceMetricsTest();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    setupPageFilters();
  });

  it.each([false, true])(
    'links to the metric sample span (raw names: %s)',
    async useRawAttributeNames => {
      const traceId = 'a'.repeat(32);
      const spanId = 'b'.repeat(16);
      const {detailedFixtures} = createTraceMetricFixtures(
        organization,
        project,
        new Date()
      );
      const dataRow = {...detailedFixtures[0]!, trace: traceId, span_id: spanId};
      const testOrganization = OrganizationFixture({
        ...organization,
        features: useRawAttributeNames
          ? ['tracemetrics-enabled', 'trace-item-details-raw-attribute-names']
          : ['tracemetrics-enabled'],
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/trace-items/${dataRow.id}/`,
        body: {
          itemId: dataRow.id,
          timestamp: dataRow.timestamp,
          links: null,
          meta: {},
          attributes: [
            {
              name: useRawAttributeNames ? 'sentry.trace_id' : 'trace',
              queryName: 'trace',
              type: 'str',
              value: traceId,
            },
            {name: 'sentry.span_id', type: 'str', value: spanId},
          ],
        },
      });

      render(
        <MetricDetails dataRow={dataRow} ref={{current: null}} showTelemetry={false} />,
        {organization: testOrganization, additionalWrapper: Wrapper}
      );

      const link = await screen.findByRole('link', {name: spanId});
      const href = link.getAttribute('href')!;
      expect(href).toContain(`/trace/${traceId}/`);
      expect(qs.parse(href.split('?')[1]!)).toMatchObject({
        node: `span-${spanId}`,
        source: 'trace_metrics',
      });
    }
  );
});
