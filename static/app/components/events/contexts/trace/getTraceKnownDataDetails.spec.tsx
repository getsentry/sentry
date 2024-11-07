import type {Location} from 'history';
import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {traceKnownDataValues} from 'sentry/components/events/contexts/trace';
import {getTraceKnownDataDetails} from 'sentry/components/events/contexts/trace/getTraceKnownDataDetails';

import {traceMockData} from './index.spec';

describe('getTraceKnownDataDetails', function () {
  it('returns values and according to the parameters', function () {
    const allKnownData: ReturnType<typeof getTraceKnownDataDetails>[] = [];

    for (const type of Object.keys(traceKnownDataValues)) {
      const traceKnownData = getTraceKnownDataDetails({
        type: traceKnownDataValues[type],
        data: traceMockData,
        organization: OrganizationFixture(),
        event: EventFixture(),
        location: {query: {}} as Location,
      });

      if (!traceKnownData) {
        continue;
      }

      allKnownData.push(traceKnownData);
    }

    expect(allKnownData).toEqual([
      {
        subject: 'Trace ID',
        value: '12312012123120121231201212312012',
        action: {link: expect.anything()},
      },
      {subject: 'Span ID', value: '0415201309082013'},
      {subject: 'Parent Span ID', value: '123'},
      {subject: 'Operation Name', value: 'http.server'},
      {subject: 'Status', value: 'not_found'},
      {subject: 'Exclusive Time (ms)', value: 1.035},
      {subject: 'Client Sample Rate', value: 0.1},
      {
        subject: 'Dynamic Sampling Context',
        value: {
          trace_id: '12312012123120121231201212312012',
          sample_rate: '1.0',
          public_key: '93D0D1125146288EAEE2A9B3AF4F96CCBE3CB316',
        },
      },
      {subject: 'Origin', value: 'auto.http.http_client_5'},
      {subject: 'Data', value: {route: expect.anything()}},
    ]);
  });
});
