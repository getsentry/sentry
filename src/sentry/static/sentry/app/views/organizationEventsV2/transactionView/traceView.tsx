import React from 'react';
import {get, set, isNumber} from 'lodash';

import {t} from 'app/locale';
import EmptyStateWarning from 'app/components/emptyStateWarning';

import DragManager, {DragManagerChildrenProps} from './dragManager';
import SpanTree from './spanTree';
import {SpanType, SpanEntry, SentryTransactionEvent, ParsedTraceType} from './types';
import {isValidSpanID} from './utils';
import TraceViewMinimap from './minimap';
import * as CursorGuideHandler from './cursorGuideHandler';

// type TraceContextType = {
//   type: 'trace';
//   span_id: string;
//   trace_id: string;
// };

type PropType = {
  event: Readonly<SentryTransactionEvent>;
};

class TraceView extends React.Component<PropType> {
  minimapInteractiveRef = React.createRef<HTMLDivElement>();

  renderMinimap = (dragProps: DragManagerChildrenProps, parsedTrace: ParsedTraceType) => {
    return (
      <TraceViewMinimap
        minimapInteractiveRef={this.minimapInteractiveRef}
        dragProps={dragProps}
        trace={parsedTrace}
      />
    );
  };

  getTraceContext = () => {
    // const {event} = this.props;

    // const traceContext: TraceContextType | undefined = get(event, 'contexts.trace');
    // return traceContext;

    return {
      sampled: true,
      start_timestamp: 1566588804.677,
      transaction: '/settings/:orgId/projects/:projectId/filters/:filterType/',
      timestamp: 1566588806.14,
      trace_id: '39b7c04185204bb0b1320b60e979803c',
      span_id: 'abbd52b605bba1c5',
      type: 'trace',
      op: 'navigation',
    };
  };

  parseTrace = (): ParsedTraceType => {
    const {event} = this.props;

    // @ts-ignore
    event.startTimestamp = 1566588804.677;
    // @ts-ignore
    event.endTimestamp = 1566588806.14;

    // @ts-ignore
    event.entries = [
      {
        type: 'spans',
        data: [
          {
            sampled: true,
            start_timestamp: 1566588804.726,
            description: 'GET /api/0/projects/food52/food52-frontend/filters/',
            timestamp: 1566588804.926,
            parent_span_id: 'abbd52b605bba1c5',
            trace_id: '39b7c04185204bb0b1320b60e979803c',
            op: 'http',
            data: {},
            span_id: '82d310155acd13a3',
          },
          {
            sampled: true,
            start_timestamp: 1566588804.729,
            description:
              'GET /api/0/projects/food52/food52-frontend/stats/?stat=ip-address&since=1563996804&until=1566588804&resolution=1d',
            timestamp: 1566588804.93,
            parent_span_id: 'abbd52b605bba1c5',
            trace_id: '39b7c04185204bb0b1320b60e979803c',
            op: 'http',
            data: {},
            span_id: 'b66ff9a6dd45e532',
          },
          {
            sampled: true,
            start_timestamp: 1566588804.731,
            description:
              'GET /api/0/projects/food52/food52-frontend/stats/?stat=error-message&since=1563996804&until=1566588804&resolution=1d',
            timestamp: 1566588804.935,
            parent_span_id: 'abbd52b605bba1c5',
            trace_id: '39b7c04185204bb0b1320b60e979803c',
            op: 'http',
            data: {},
            span_id: '967cb7b129c0eb91',
          },
          {
            sampled: true,
            start_timestamp: 1566588804.73,
            description:
              'GET /api/0/projects/food52/food52-frontend/stats/?stat=release-version&since=1563996804&until=1566588804&resolution=1d',
            timestamp: 1566588804.943,
            parent_span_id: 'abbd52b605bba1c5',
            trace_id: '39b7c04185204bb0b1320b60e979803c',
            op: 'http',
            data: {},
            span_id: '9e7f139291b534ce',
          },
          {
            sampled: true,
            start_timestamp: 1566588804.734,
            description:
              'GET /api/0/projects/food52/food52-frontend/stats/?stat=browser-extensions&since=1563996804&until=1566588804&resolution=1d',
            timestamp: 1566588804.945,
            parent_span_id: 'abbd52b605bba1c5',
            trace_id: '39b7c04185204bb0b1320b60e979803c',
            op: 'http',
            data: {},
            span_id: '9fa60a8766e60977',
          },
          {
            sampled: true,
            start_timestamp: 1566588804.735,
            description:
              'GET /api/0/projects/food52/food52-frontend/stats/?stat=legacy-browsers&since=1563996804&until=1566588804&resolution=1d',
            timestamp: 1566588805.039,
            parent_span_id: 'abbd52b605bba1c5',
            trace_id: '39b7c04185204bb0b1320b60e979803c',
            op: 'http',
            data: {},
            span_id: 'bc1c1b21595b5f02',
          },
          {
            sampled: true,
            start_timestamp: 1566588804.737,
            description:
              'GET /api/0/projects/food52/food52-frontend/stats/?stat=invalid-csp&since=1563996804&until=1566588804&resolution=1d',
            timestamp: 1566588805.059,
            parent_span_id: 'abbd52b605bba1c5',
            trace_id: '39b7c04185204bb0b1320b60e979803c',
            op: 'http',
            data: {},
            span_id: '8e84be67e537b9e1',
          },
          {
            sampled: true,
            start_timestamp: 1566588804.739,
            description:
              'GET /api/0/projects/food52/food52-frontend/stats/?stat=cors&since=1563996804&until=1566588804&resolution=1d',
            timestamp: 1566588805.061,
            parent_span_id: 'abbd52b605bba1c5',
            trace_id: '39b7c04185204bb0b1320b60e979803c',
            op: 'http',
            data: {},
            span_id: 'bb69297fe299b8db',
          },
          {
            sampled: true,
            start_timestamp: 1566588804.736,
            description:
              'GET /api/0/projects/food52/food52-frontend/stats/?stat=localhost&since=1563996804&until=1566588804&resolution=1d',
            timestamp: 1566588805.087,
            parent_span_id: 'abbd52b605bba1c5',
            trace_id: '39b7c04185204bb0b1320b60e979803c',
            op: 'http',
            data: {},
            span_id: '9dfbc565040211c0',
          },
          {
            sampled: true,
            start_timestamp: 1566588805.998,
            description:
              'GET /api/0/projects/food52/food52-frontend/stats/?stat=web-crawlers&since=1563996804&until=1566588804&resolution=1d',
            timestamp: 1566588806.1,
            parent_span_id: 'abbd52b605bba1c5',
            trace_id: '39b7c04185204bb0b1320b60e979803c',
            op: 'http',
            data: {},
            span_id: 'a5ab14bfa748ada5',
          },
          {
            sampled: true,
            start_timestamp: 1566588805.127,
            description: 'GET /api/0/projects/food52/food52-frontend/',
            timestamp: 1566588806.399,
            parent_span_id: 'abbd52b605bba1c5',
            trace_id: '39b7c04185204bb0b1320b60e979803c',
            op: 'http',
            data: {},
            span_id: 'a691847aa21f5372',
          },
          {
            sampled: true,
            start_timestamp: 1566588805.41,
            description:
              'GET /api/0/projects/food52/food52-frontend/stats/?stat=discarded-hash&since=1563996804&until=1566588804&resolution=1d',
            timestamp: 1566588806.239,
            parent_span_id: 'abbd52b605bba1c5',
            trace_id: '39b7c04185204bb0b1320b60e979803c',
            op: 'http',
            data: {},
            span_id: '89ba85abddfdf9af',
          },
        ],
      },
      {
        type: 'breadcrumbs',
        data: {
          values: [
            {
              category: 'sentry',
              level: 'error',
              event_id: '5c083fb3fc6240a084a6c482d4091b5b',
              timestamp: '2019-08-23T19:31:39.073Z',
              data: null,
              message: '5c083fb3fc6240a084a6c482d4091b5b',
              type: 'default',
            },
            {
              category: 'fetch',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:31:39.122Z',
              data: {
                url:
                  'https://ingest.sentry.io/api/1218870/store/?sentry_key=8f35a62cf3e444d18a963bd9ed9c1067&sentry_version=7',
                status_code: 200,
                method: 'POST',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'ui.click',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:31:40.121Z',
              data: null,
              message:
                'div.css-roynbj > div.css-uewl2b.e1xswuu60 > a.css-qjxdpu.e1r0ei0g1',
              type: 'default',
            },
            {
              category: 'navigation',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:31:40.122Z',
              data: {
                to: '/settings/food52/projects/food52-frontend/',
                from: '/settings/food52/projects/food52-frontend/environments/',
              },
              message: null,
              type: 'default',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:31:40.190Z',
              data: {
                url: 'https://reload.getsentry.net/page/',
                status_code: 201,
                method: 'POST',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:31:40.303Z',
              data: {
                url: '/api/0/grouping-enhancements/',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:31:40.307Z',
              data: {
                url: '/api/0/grouping-configs/',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:31:40.519Z',
              data: {
                url: '/api/0/projects/food52/food52-frontend/',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:31:41.357Z',
              data: {
                url: 'https://reload.getsentry.net/metric/',
                status_code: 201,
                method: 'POST',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'sentry',
              level: 'error',
              event_id: '6b8b366da79e4e7c85bd7645c3f9b942',
              timestamp: '2019-08-23T19:31:45.133Z',
              data: null,
              message: '6b8b366da79e4e7c85bd7645c3f9b942',
              type: 'default',
            },
            {
              category: 'fetch',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:31:45.183Z',
              data: {
                url:
                  'https://ingest.sentry.io/api/1218870/store/?sentry_key=8f35a62cf3e444d18a963bd9ed9c1067&sentry_version=7',
                status_code: 200,
                method: 'POST',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'navigation',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:23.726Z',
              data: {
                to: '/settings/food52/projects/food52-frontend/environments/',
                from: '/settings/food52/projects/food52-frontend/',
              },
              message: null,
              type: 'default',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:23.998Z',
              data: {
                url:
                  '/api/0/projects/food52/food52-frontend/environments/?visibility=visible',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'sentry',
              level: 'error',
              event_id: '88364a43d66345ee9c670e155a21474d',
              timestamp: '2019-08-23T19:33:24.676Z',
              data: null,
              message: '88364a43d66345ee9c670e155a21474d',
              type: 'default',
            },
            {
              category: 'navigation',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:24.741Z',
              data: {
                to: '/settings/food52/projects/food52-frontend/filters/data-filters/',
                from: '/settings/food52/projects/food52-frontend/environments/',
              },
              message: null,
              type: 'default',
            },
            {
              category: 'fetch',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:24.856Z',
              data: {
                url:
                  'https://ingest.sentry.io/api/1218870/store/?sentry_key=8f35a62cf3e444d18a963bd9ed9c1067&sentry_version=7',
                status_code: 200,
                method: 'POST',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:24.919Z',
              data: {
                url: '/api/0/projects/food52/food52-frontend/filters/',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:24.927Z',
              data: {
                url:
                  '/api/0/projects/food52/food52-frontend/stats/?stat=ip-address&since=1563996804&until=1566588804&resolution=1d',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:24.932Z',
              data: {
                url:
                  '/api/0/projects/food52/food52-frontend/stats/?stat=error-message&since=1563996804&until=1566588804&resolution=1d',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:24.940Z',
              data: {
                url:
                  '/api/0/projects/food52/food52-frontend/stats/?stat=release-version&since=1563996804&until=1566588804&resolution=1d',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:24.943Z',
              data: {
                url:
                  '/api/0/projects/food52/food52-frontend/stats/?stat=browser-extensions&since=1563996804&until=1566588804&resolution=1d',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:25.036Z',
              data: {
                url:
                  '/api/0/projects/food52/food52-frontend/stats/?stat=legacy-browsers&since=1563996804&until=1566588804&resolution=1d',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:25.056Z',
              data: {
                url:
                  '/api/0/projects/food52/food52-frontend/stats/?stat=invalid-csp&since=1563996804&until=1566588804&resolution=1d',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:25.059Z',
              data: {
                url:
                  '/api/0/projects/food52/food52-frontend/stats/?stat=cors&since=1563996804&until=1566588804&resolution=1d',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:25.085Z',
              data: {
                url:
                  '/api/0/projects/food52/food52-frontend/stats/?stat=localhost&since=1563996804&until=1566588804&resolution=1d',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:25.106Z',
              data: {
                url:
                  '/api/0/projects/food52/food52-frontend/stats/?stat=web-crawlers&since=1563996804&until=1566588804&resolution=1d',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:25.119Z',
              data: {
                url: '/api/0/projects/food52/food52-frontend/',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:25.142Z',
              data: {
                url:
                  '/api/0/projects/food52/food52-frontend/stats/?stat=discarded-hash&since=1563996804&until=1566588804&resolution=1d',
                status_code: 200,
                method: 'GET',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:25.186Z',
              data: {
                url: 'https://reload.getsentry.net/metric/',
                status_code: 201,
                method: 'POST',
              },
              message: null,
              type: 'http',
            },
            {
              category: 'xhr',
              level: 'info',
              event_id: null,
              timestamp: '2019-08-23T19:33:26.103Z',
              data: {
                url: 'https://reload.getsentry.net/metric/',
                status_code: 201,
                method: 'POST',
              },
              message: null,
              type: 'http',
            },
          ],
        },
      },
      {
        type: 'request',
        data: {
          fragment: null,
          cookies: [],
          inferredContentType: null,
          env: null,
          headers: [
            [
              'User-Agent',
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/76.0.3809.100 Safari/537.36',
            ],
          ],
          url: 'https://sentry.io/settings/food52/projects/food52-frontend/',
          query: [],
          data: null,
          method: null,
        },
      },
    ];

    const spanEntry: SpanEntry | undefined = event.entries.find(
      (entry: {type: string}) => entry.type === 'spans'
    );

    const spans: Array<SpanType> = get(spanEntry, 'data', []);

    const traceContext = this.getTraceContext();
    const traceID = (traceContext && traceContext.trace_id) || '';
    const rootSpanID = (traceContext && traceContext.span_id) || '';

    if (!spanEntry || spans.length <= 0) {
      return {
        childSpans: {},
        traceStartTimestamp: event.startTimestamp,
        traceEndTimestamp: event.endTimestamp,
        traceID,
        rootSpanID,
        numOfSpans: 0,
      };
    }

    // we reduce spans to become an object mapping span ids to their children

    const init: ParsedTraceType = {
      childSpans: {},
      traceStartTimestamp: event.startTimestamp,
      traceEndTimestamp: event.endTimestamp,
      traceID,
      rootSpanID,
      numOfSpans: spans.length,
    };

    const reduced: ParsedTraceType = spans.reduce((acc, span) => {
      if (!isValidSpanID(span.parent_span_id)) {
        return acc;
      }

      const spanChildren: Array<SpanType> = get(acc.childSpans, span.parent_span_id!, []);

      spanChildren.push(span);

      set(acc.childSpans, span.parent_span_id!, spanChildren);

      if (!acc.traceStartTimestamp || span.start_timestamp < acc.traceStartTimestamp) {
        acc.traceStartTimestamp = span.start_timestamp;
      }

      // establish trace end timestamp

      const hasEndTimestamp = isNumber(span.timestamp);

      if (!acc.traceEndTimestamp) {
        if (hasEndTimestamp) {
          acc.traceEndTimestamp = span.timestamp;
          return acc;
        }

        acc.traceEndTimestamp = span.start_timestamp;
        return acc;
      }

      if (hasEndTimestamp && span.timestamp! > acc.traceEndTimestamp) {
        acc.traceEndTimestamp = span.timestamp;
        return acc;
      }

      if (span.start_timestamp > acc.traceEndTimestamp) {
        acc.traceEndTimestamp = span.start_timestamp;
      }

      return acc;
    }, init);

    // sort span children by their start timestamps in ascending order

    Object.values(reduced.childSpans).forEach(spanChildren => {
      spanChildren.sort((firstSpan, secondSpan) => {
        if (firstSpan.start_timestamp < secondSpan.start_timestamp) {
          return -1;
        }

        if (firstSpan.start_timestamp === secondSpan.start_timestamp) {
          return 0;
        }

        return 1;
      });
    });

    return reduced;
  };

  render() {
    if (!this.getTraceContext()) {
      return (
        <EmptyStateWarning>
          <p>{t('There is no trace for this transaction')}</p>
        </EmptyStateWarning>
      );
    }

    const parsedTrace = this.parseTrace();

    return (
      <DragManager interactiveLayerRef={this.minimapInteractiveRef}>
        {(dragProps: DragManagerChildrenProps) => {
          return (
            <CursorGuideHandler.Provider
              interactiveLayerRef={this.minimapInteractiveRef}
              dragProps={dragProps}
              trace={parsedTrace}
            >
              {this.renderMinimap(dragProps, parsedTrace)}
              <SpanTree trace={parsedTrace} dragProps={dragProps} />
            </CursorGuideHandler.Provider>
          );
        }}
      </DragManager>
    );
  }
}

export default TraceView;
