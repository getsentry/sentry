import logging

from collections import deque

from rest_framework.response import Response

from sentry import features, eventstore
from sentry.api.bases import OrganizationEventsEndpointBase, NoProjects
from sentry.snuba import discover


logger = logging.getLogger(__name__)
MAX_TRACE_SIZE = 100


def find_event(items, function, default=None):
    return next(filter(function, items), default)


def is_root(item):
    return item["root"] == "1"


class OrganizationEventsTraceEndpointBase(OrganizationEventsEndpointBase):
    def has_feature(self, organization, request):
        return features.has(
            "organizations:trace-view-quick", organization, actor=request.user
        ) or features.has("organizations:trace-view-summary", organization, actor=request.user)

    def serialize_event(self, event, parent, generation=None, is_root_event=False):
        return {
            "event_id": event["id"],
            "span_id": event["trace.span"],
            "transaction": event["transaction"],
            "transaction.duration": event["transaction.duration"],
            "project_id": event["project.id"],
            "project_slug": event["project"],
            "parent_event_id": parent,
            # Avoid empty string for root events
            "parent_span_id": event["trace.parent_span"] or None,
            # TODO(wmak) remove once we switch over to generation
            "is_root": is_root_event,
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
                selected_columns=[
                    "id",
                    "timestamp",
                    "transaction.duration",
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
            warning_extra["extra_roots"] = extra_roots
            logger.warning(
                "discover.trace-view.root.extra-found",
                {"extra_roots": extra_roots, **warning_extra},
            )

        parent_map = {item["trace.parent_span"]: item for item in result["data"]}
        return Response(self.serialize(parent_map, root, warning_extra, snuba_event, event_id))


class OrganizationEventsTraceLightEndpoint(OrganizationEventsTraceEndpointBase):
    def serialize(self, parent_map, root, warning_extra, snuba_event, event_id=None):
        """ Because the light endpoint could potentially have gaps between root and event we return a flattened list """
        trace_results = [self.serialize_event(root, None, 0, True)]

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
                    snuba_event, root["id"] if is_root_child else None, 1 if is_root_child else None
                )
            )

        event = eventstore.get_event_by_id(snuba_event["project.id"], event_id)
        for span in event.data.get("spans", []):
            if span["span_id"] in parent_map:
                child_event = parent_map[span["span_id"]]
                trace_results.append(self.serialize_event(child_event, event_id))

        return trace_results


class OrganizationEventsTraceEndpoint(OrganizationEventsTraceEndpointBase):
    def serialize_event(self, *args, **kwargs):
        event = super().serialize_event(*args, **kwargs)
        event["children"] = []
        return event

    def serialize(self, parent_map, root, warning_extra, snuba_event=None, event_id=None):
        """ For the full event trace, we return the results as a graph instead of a flattened list """
        parent_events = {}
        result = parent_events[root["id"]] = self.serialize_event(root, None, 0, True)

        to_check = deque([root])
        iteration = 0
        while to_check:
            current_event = to_check.popleft()
            event = eventstore.get_event_by_id(current_event["project.id"], current_event["id"])
            previous_event = parent_events[current_event["id"]]
            for child in event.data.get("spans", []):
                if child["span_id"] not in parent_map:
                    continue
                # Avoid potential span loops by popping, so we don't traverse the same nodes twice
                child_event = parent_map.pop(child["span_id"])

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
