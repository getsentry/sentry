import logging
import sentry_sdk

from collections import defaultdict, deque

from rest_framework.response import Response

from sentry import features, eventstore
from sentry.api.bases import OrganizationEventsV2EndpointBase, NoProjects
from sentry.snuba import discover


logger = logging.getLogger(__name__)
MAX_TRACE_SIZE = 100
NODESTORE_KEYS = ["timestamp", "start_timestamp"]


def find_event(items, function, default=None):
    return next(filter(function, items), default)


def is_root(item):
    return item["root"] == "1"


class OrganizationEventsTraceEndpointBase(OrganizationEventsV2EndpointBase):
    def has_feature(self, organization, request):
        return features.has(
            "organizations:trace-view-quick", organization, actor=request.user
        ) or features.has("organizations:trace-view-summary", organization, actor=request.user)

    def serialize_event(self, event, parent, generation=None):
        return {
            "event_id": event["id"],
            "span_id": event["trace.span"],
            "transaction": event["transaction"],
            "transaction.duration": event["transaction.duration"],
            "transaction.op": event["transaction.op"],
            "project_id": event["project.id"],
            "project_slug": event["project"],
            "parent_event_id": parent,
            # Avoid empty string for root events
            "parent_span_id": event["trace.parent_span"] or None,
            # Can be None on the light trace when we don't know the parent
            "generation": generation,
        }

    def get(self, request, organization, trace_id):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response(status=404)

        with self.handle_query_errors():
            result = discover.query(
                # selected_columns is a set list, since we only want to include the minimum to render the trace
                selected_columns=[
                    "id",
                    "timestamp",
                    "transaction.duration",
                    "transaction.op",
                    "transaction",
                    # project gets the slug, and project.id gets added automatically
                    "project",
                    "trace.span",
                    "trace.parent_span",
                    'to_other(trace.parent_span, "", 0, 1) AS root',
                ],
                # We want to guarantee at least getting the root, and hopefully events near it with timestamp
                # id is just for consistent results
                orderby=["-root", "-timestamp", "id"],
                params=params,
                query=f"event.type:transaction trace:{trace_id}",
                limit=MAX_TRACE_SIZE,
                referrer="api.trace-view.get_ids",
            )
            if len(result["data"]) == 0:
                return Response(status=404)

        event_id = request.GET.get("event_id")
        warning_extra = {"trace": trace_id, "organization": organization}

        if event_id:
            snuba_event = find_event(result["data"], lambda item: item["id"] == event_id)
            # The current event couldn't be found in the snuba results
            if snuba_event is None:
                return Response(status=404)
        else:
            snuba_event = None

        if not is_root(result["data"][0]):
            logger.warning(
                "discover.trace-view.root.not-found",
                extra=warning_extra,
            )
            return Response(status=204)

        root = result["data"][0]

        # Look for extra roots
        extra_roots = 0
        for item in result["data"][1:]:
            if is_root(item):
                extra_roots += 1
            else:
                break
        if extra_roots > 0:
            logger.warning(
                "discover.trace-view.root.extra-found",
                {"extra_roots": extra_roots, **warning_extra},
            )

        parent_map = defaultdict(list)
        for item in result["data"]:
            parent_map[item["trace.parent_span"]].append(item)

        # Temporarily feature flagging this out, since errors will impact performance
        if not features.has("organizations:trace-view-summary", organization, actor=request.user):
            error_map = []
        else:
            error_map = self.get_error_map(organization, trace_id, params)

        return Response(
            self.serialize(
                parent_map, error_map, root, warning_extra, params, snuba_event, event_id
            )
        )


class OrganizationEventsTraceLightEndpoint(OrganizationEventsTraceEndpointBase):
    def get_error_map(self, *args, **kwargs):
        """We don't get the error map for the light view

        This is because we only get spans for the root + current event, which means we could only create an error
        to transaction association for up to two events.
        """
        return {}

    def serialize(
        self, parent_map, error_map, root, warning_extra, params, snuba_event, event_id=None
    ):
        """ Because the light endpoint could potentially have gaps between root and event we return a flattened list """
        trace_results = [self.serialize_event(root, None, 0)]

        with sentry_sdk.start_span(op="building.trace", description="light trace"):
            if root["id"] != event_id:
                # Get the root event and see if the current event's span is in the root event
                root_event = eventstore.get_event_by_id(root["project.id"], root["id"])
                root_span = find_event(
                    root_event.data.get("spans", []),
                    lambda item: item["span_id"] == snuba_event["trace.parent_span"],
                )

                # For the light response, the parent will be unknown unless it is a direct descendent of the root
                is_root_child = root_span is not None
                trace_results.append(
                    self.serialize_event(
                        snuba_event,
                        root["id"] if is_root_child else None,
                        1 if is_root_child else None,
                    )
                )

            event = eventstore.get_event_by_id(snuba_event["project.id"], event_id)

            spans = event.data.get("spans", [])
            # Need to include the transaction as a span as well
            spans.append({"span_id": snuba_event["trace.span"]})

            for span in spans:
                if span["span_id"] in parent_map:
                    child_events = parent_map[span["span_id"]]
                    trace_results.extend(
                        [
                            self.serialize_event(child_event, event_id)
                            for child_event in child_events
                        ]
                    )

        return trace_results


class OrganizationEventsTraceEndpoint(OrganizationEventsTraceEndpointBase):
    def get_error_map(self, organization, trace_id, params):
        with sentry_sdk.start_span(op="discover", description="getting trace errors"):
            # This can't be combined with the transaction query since we need dataset specific fields
            error_results = discover.query(
                selected_columns=[
                    "id",
                    "project",
                    "timestamp",
                    "trace.span",
                ],
                orderby=["-timestamp", "id"],
                params=params,
                query=f"!event.type:transaction trace:{trace_id}",
                limit=MAX_TRACE_SIZE,
                # we can get project from the associated transaction, which can save us a db query
                auto_fields=False,
                referrer="api.trace-view.get_errors",
            )

            # Use issue ids to get the error's short id
            error_map = defaultdict(list)
            if error_results["data"]:
                for row in error_results["data"]:
                    error_map[row["trace.span"]].append(self.serialize_error(row))
            return error_map

    def serialize_error(self, event):
        return {
            "event_id": event["id"],
            "span": event["trace.span"],
            "project_id": event["project.id"],
            "project_slug": event["project"],
        }

    def serialize_event(self, *args, **kwargs):
        event = super().serialize_event(*args, **kwargs)
        event.update(
            {
                "children": [],
                "errors": [],
            }
        )
        return event

    def serialize(
        self, parent_map, error_map, root, warning_extra, params, snuba_event=None, event_id=None
    ):
        """ For the full event trace, we return the results as a graph instead of a flattened list """
        parent_events = {}
        result = parent_events[root["id"]] = self.serialize_event(root, None, 0)

        with sentry_sdk.start_span(op="building.trace", description="full trace"):
            to_check = deque([root])
            iteration = 0
            while to_check:
                current_event = to_check.popleft()

                # This is faster than doing a call to get_events, since get_event_by_id only makes a call to snuba
                # when non transaction events are included.
                with sentry_sdk.start_span(op="nodestore", description="get_event_by_id"):
                    event = eventstore.get_event_by_id(
                        current_event["project.id"], current_event["id"]
                    )

                previous_event = parent_events[current_event["id"]]
                previous_event.update(
                    {event_key: event.data.get(event_key) for event_key in NODESTORE_KEYS}
                )

                spans = event.data.get("spans", [])
                # Need to include the transaction as a span as well
                spans.append({"span_id": previous_event["span_id"]})

                for child in spans:
                    if child["span_id"] in error_map:
                        previous_event["errors"].extend(error_map.pop(child["span_id"]))
                    if child["span_id"] not in parent_map:
                        continue
                    # Avoid potential span loops by popping, so we don't traverse the same nodes twice
                    child_events = parent_map.pop(child["span_id"])

                    for child_event in child_events:
                        parent_events[child_event["id"]] = self.serialize_event(
                            child_event, current_event["id"], previous_event["generation"] + 1
                        )
                        # Add this event to its parent's children
                        previous_event["children"].append(parent_events[child_event["id"]])

                        to_check.append(child_event)
                # Limit iterations just to be safe
                iteration += 1
                if iteration > MAX_TRACE_SIZE:
                    logger.warning(
                        "discover.trace-view.surpassed-trace-limit",
                        extra=warning_extra,
                    )
                    break

        return result
