import {Event as EventFixture} from 'sentry-fixture/event';
import {Organization} from 'sentry-fixture/organization';

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
        organization: Organization(),
        event: EventFixture(),
      });

      if (!traceKnownData) {
        continue;
      }

      allKnownData.push(traceKnownData);
    }

    expect(allKnownData).toEqual([
      {subject: 'Status', value: 'unknown'},
      {subject: 'Trace ID', value: '61d2d7c5acf448ffa8e2f8f973e2cd36'},
      {subject: 'Span ID', value: 'a5702f287954a9ef'},
      {subject: 'Parent Span ID', value: 'b23703998ae619e7'},
      {subject: 'Operation Name', value: 'something'},
    ]);
  });
});
