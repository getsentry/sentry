from __future__ import absolute_import

from sentry.models import Event


def transform_to_spans(events):
    """
    Transform events into their span equivalent

    While we currently store spans inside 'transaction'
    type events that may not always be the case. Our tracing
    APIs should only emit the span shaped data from our events
    """
    Event.objects.bind_nodes(events, 'data')
    spans = []
    for event in events:
        spans.extend(_transform_to_spans(event))
    return spans


def _transform_to_spans(event):
    """
    Each event contains a bit of tracing data that we have to
    extract out of the context and interfaces, as well as 0-N
    child spans
    """
    contexts = event.get_interface('contexts')
    context_data = contexts.get_api_context().get('trace', {})

    root_span = {
        'traceId': context_data.get('trace_id'),
        'spanId': context_data.get('span_id'),
        'parentSpanId': context_data.get('parent_span_id', None),
        'description': event.title,
        'op': 'transaction',
        'startTimestamp': event.data['start_timestamp'],
        'endTimestamp': event.data['timestamp'],
        'tags': event.tags,
        'data': {}
    }
    spans = [root_span]
    for span in event.data['spans']:
        spans.append(_transform_span(span))

    return spans


def _transform_span(span):
    return {
        'traceId': span.get('trace_id'),
        'spanId': span.get('span_id'),
        'parentSpanId': span.get('parent_span_id', None),
        'description': span.get('description', ''),
        'op': span.get('op', ''),
        'startTimestamp': span.get('start_timestamp'),
        'endTimestamp': span.get('timestamp'),
        'tags': span.get('tags', {}),
        'data': span.get('data', {}),
    }
