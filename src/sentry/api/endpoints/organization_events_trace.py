import logging
import sentry_sdk

from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from sentry import features, eventstore
from sentry.api.bases import OrganizationEventsEndpointBase, NoProjects
from sentry.snuba import discover


logger = logging.getLogger(__name__)


def serialize_event(event, parent, is_root=False):
    return {
        "event_id": event["id"],
        "span_id": event["trace.span"],
        "transaction": event["transaction"],
        "project_id": event["project_id"],
        "parent_event_id": parent,
        "is_root": is_root,
    }


class OrganizationEventsTraceLightEndpoint(OrganizationEventsEndpointBase):
    def has_feature(self, organization, request):
        return features.has(
            "organizations:trace-view-quick", organization, actor=request.user
        ) or features.has("organizations:trace-view-summary", organization, actor=request.user)

    def get(self, request, organization, trace_id):
        if not self.has_feature(organization, request):
            return Response(status=404)

        try:
            params = self.get_snuba_params(request, organization)
        except NoProjects:
            return Response([])

        with self.handle_query_errors():
            result = discover.query(
                selected_columns=[
                    "id",
                    "timestamp",
                    "transaction",
                    "project_id",
                    "trace.span",
                    "trace.parent_span",
                    'to_other(trace.parent_span, "", 0, 1) AS root',
                ],
                # We want to guarantee at least getting the root, and hopefully events near it with timestamp
                # id is just for consistent results
                orderby=["-root", "-timestamp", "id"],
                params=params,
                query=f"event.type:transaction trace:{trace_id}",
                limit=100,
                referrer="api.trace-view.get_ids",
            )
            if len(result["data"]) == 0:
                return Response(status=404)

        event_id = request.GET.get("event_id")
        if event_id is None:
            raise ParseError("Only the light trace view is supported at this time")
        is_root = lambda item: item["root"] == "1"

        if is_root(result["data"][0]):
            root = result["data"][0]
        else:
            root = None
            logger.warning(
                "discover.trace-view.root.not-found",
                extra={"trace": trace_id, "organization": organization},
            )
            return Response(status=204)

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
                extra={"trace": trace_id, "organization": organization, "extra_roots": extra_roots},
            )

        return Response(self.serialize(result["data"], root, event_id))

    def serialize(self, result, root, event_id=None):
        parent_map = {item["trace.parent_span"]: item for item in result}
        trace_results = [serialize_event(root, None, True)]

        snuba_event = next((item for item in result if item["id"] == event_id), None)
        if snuba_event is None:
            sentry_sdk.set_tag("query.error_reason", "Matching event not found")
            raise ParseError("event matching matching requested id not found")

        if root["id"] != event_id:
            # Get the root event and see if the current event's span is in the root event
            root_event = eventstore.get_event_by_id(root["project_id"], root["id"])
            root_span = next(
                (
                    item
                    for item in root_event.data.get("spans", [])
                    if item["span_id"] == snuba_event["trace.parent_span"]
                ),
                None,
            )

            # For the light response, the parent will be unknown unless we're a direct descendent of the root
            trace_results.append(
                serialize_event(snuba_event, root["id"] if root_span is not None else None)
            )

        event = eventstore.get_event_by_id(snuba_event["project_id"], event_id)
        for span in event.data.get("spans", []):
            if span["span_id"] in parent_map:
                child_event = parent_map[span["span_id"]]
                trace_results.append(serialize_event(child_event, event_id))

        return trace_results
