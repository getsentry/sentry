import {addInstrumentationHandler} from '@sentry/utils';

export class HTTPTimingIntegration {
  static id = 'HTTPTimingIntegration';

  name = HTTPTimingIntegration.id;
  options = undefined;

  constructor(options?) {
    this.options = options;
  }

  static getTimingOffsets(r: PerformanceResourceTiming) {
    const {startTime, requestStart, responseStart, domainLookupStart, connectStart} = r;
    return {
      startTime: 0,
      requestStart: requestStart - startTime,
      responseStart: responseStart - startTime,
      connectStart: connectStart - startTime,
      domainLookupStart: domainLookupStart - startTime,
    };
  }

  setupOnce() {
    addInstrumentationHandler('fetch', handlerData => {
      setTimeout(() => {
        try {
          const spanId = handlerData.fetchData.__span;

          const Sentry = (window as any).Sentry;

          // Replace this with access to the spans object in sdk request if porting to sdk.
          if (!Sentry) {
            return;
          }

          const transaction = Sentry.getActiveTransaction();
          if (!transaction) {
            return;
          }
          const spans = transaction.spanRecorder?.spans;

          if (!spans || spans?.length > 1000) {
            // This should be pretty fast but incase spans is unbounded don't do O(n) lookup for spanid.
            return;
          }

          const span = spans.find(s => s.spanId === spanId);

          if (!span) {
            return;
          }
          const fetches = performance
            .getEntriesByType('resource')
            .filter(r => (r as PerformanceResourceTiming).initiatorType === 'fetch');
          const matching = (fetches as PerformanceResourceTiming[]).filter(r =>
            r.name.includes(handlerData.fetchData.url)
          );
          if (!matching.length) {
            return;
          }

          const latestMatch = matching.at(-1);
          if (!latestMatch) {
            return;
          }

          span.setData(
            'http.timings',
            HTTPTimingIntegration.getTimingOffsets(latestMatch)
          );
          span.setData('http.protocol', latestMatch.nextHopProtocol);
        } catch (_) {
          // defensive catch
        }
      }, 0);
    });
  }
}
