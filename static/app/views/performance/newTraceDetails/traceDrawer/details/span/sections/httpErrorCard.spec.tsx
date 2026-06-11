import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';
import {
  makeEAPSpan,
  makeSpan,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

import {HttpErrorCard} from './httpErrorCard';

const extra = {organization: OrganizationFixture()};

describe('HttpErrorCard', () => {
  it('does not render when hasHttpError is false', () => {
    const node = new SpanNode(null, makeSpan({status: 'ok', data: {}}), extra);

    const {container} = render(<HttpErrorCard node={node} />);

    expect(container).toBeEmptyDOMElement();
  });

  describe('SpanNode', () => {
    it('displays status text and status code', () => {
      const node = new SpanNode(
        null,
        makeSpan({
          status: 'internal_error',
          data: {'http.response.status_code': 500},
        }),
        extra
      );

      render(<HttpErrorCard node={node} />);

      expect(screen.getByText('Internal Error')).toBeInTheDocument();
      expect(screen.getByText('HTTP 500')).toBeInTheDocument();
    });

    it('displays only status code when status is not set', () => {
      const node = new SpanNode(
        null,
        makeSpan({data: {'http.response.status_code': 502}}),
        extra
      );

      render(<HttpErrorCard node={node} />);

      expect(screen.getByText('HTTP Error')).toBeInTheDocument();
      expect(screen.getByText('HTTP 502')).toBeInTheDocument();
    });

    it('displays only status text when status code is not present', () => {
      const node = new SpanNode(null, makeSpan({status: 'not_found', data: {}}), extra);

      render(<HttpErrorCard node={node} />);

      expect(screen.getByText('Not Found')).toBeInTheDocument();
      expect(screen.queryByText(/HTTP \d/)).not.toBeInTheDocument();
    });
  });

  describe('EapSpanNode', () => {
    it('displays status text and status code', () => {
      const node = new EapSpanNode(
        null,
        makeEAPSpan({
          event_id: 'span-1',
          additional_attributes: {
            'span.status': 'resource_exhausted',
            'http.response.status_code': 429,
          },
        }),
        extra
      );

      render(<HttpErrorCard node={node} />);

      expect(screen.getByText('Resource Exhausted')).toBeInTheDocument();
      expect(screen.getByText('HTTP 429')).toBeInTheDocument();
    });

    it('displays only status code when span.status is not present', () => {
      const node = new EapSpanNode(
        null,
        makeEAPSpan({
          event_id: 'span-2',
          additional_attributes: {'http.response.status_code': 503},
        }),
        extra
      );

      render(<HttpErrorCard node={node} />);

      expect(screen.getByText('HTTP Error')).toBeInTheDocument();
      expect(screen.getByText('HTTP 503')).toBeInTheDocument();
    });

    it('displays only status text when status code is not present', () => {
      const node = new EapSpanNode(
        null,
        makeEAPSpan({
          event_id: 'span-3',
          additional_attributes: {'span.status': 'unavailable'},
        }),
        extra
      );

      render(<HttpErrorCard node={node} />);

      expect(screen.getByText('Unavailable')).toBeInTheDocument();
      expect(screen.queryByText(/HTTP \d/)).not.toBeInTheDocument();
    });
  });
});
