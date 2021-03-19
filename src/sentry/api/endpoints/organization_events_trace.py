import logging
import sentry_sdk

from collections import defaultdict, deque, OrderedDict

from rest_framework.response import Response

from sentry import features, eventstore
from sentry.api.bases import OrganizationEventsV2EndpointBase, NoProjects
from sentry.snuba import discover
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME


logger = logging.getLogger(__name__)
MAX_TRACE_SIZE = 100
NODESTORE_KEYS = ["timestamp", "start_timestamp"]
DETAILED_NODESTORE_KEYS = ["environment", "release"]


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

        detailed = request.GET.get("detailed", "0") == "1"
        event_id = request.GET.get("event_id")

        # selected_columns is a set list, since we only want to include the minimum to render the trace
        selected_columns = [
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
        ]
        # but if we're getting the detailed view load some extra columns
        if detailed:
            # TODO(wmak): Move op and timestamp here once we pass detailed for trace summary
            selected_columns += [
                "transaction.status",
            ]

        with self.handle_query_errors():
            result = discover.query(
                selected_columns=selected_columns,
                # We want to guarantee at least getting the root, and hopefully events near it with timestamp
                # id is just for consistent results
                orderby=["-root", "-timestamp", "id"],
                params=params,
                query=f"event.type:transaction trace:{trace_id}",
                # get 1 more so we know if the attempted trace was over 100
                limit=MAX_TRACE_SIZE + 1,
                referrer="api.trace-view.get-ids",
            )
            if len(result["data"]) == 0:
                return Response(status=404)
            len_transactions = len(result["data"])
            sentry_sdk.set_tag("trace.num_transactions", len_transactions)
            sentry_sdk.set_tag(
                "trace.num_transactions.grouped",
                "<10" if len_transactions < 10 else "<100" if len_transactions < 100 else ">100",
            )

        warning_extra = {"trace": trace_id, "organization": organization}

        if event_id:
            snuba_event = find_event(result["data"], lambda item: item["id"] == event_id)
            # The current event couldn't be found in the snuba results
            if snuba_event is None:
                return Response(status=404)
        else:
            snuba_event = None

        if not is_root(result["data"][0]):
            sentry_sdk.set_tag("discover.trace-view.warning", "root.not-found")
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
            sentry_sdk.set_tag("discover.trace-view.warning", "root.extra-found")
            logger.warning(
                "discover.trace-view.root.extra-found",
                {"extra_roots": extra_roots, **warning_extra},
            )

        parent_map = defaultdict(list)
        for item in result["data"]:
            if not is_root(item):
                parent_map[item["trace.parent_span"]].append(item)

        # Temporarily feature flagging this out, since errors will impact performance
        if not features.has("organizations:trace-view-summary", organization, actor=request.user):
            error_map = []
        else:
            error_map = self.get_error_map(organization, trace_id, params)

        return Response(
            self.serialize(
                parent_map, error_map, root, warning_extra, params, snuba_event, event_id, detailed
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
        self,
        parent_map,
        error_map,
        root,
        warning_extra,
        params,
        snuba_event,
        event_id=None,
        detailed=False,
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
                referrer="api.trace-view.get-errors",
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

    def serialize_event(self, event, *args, **kwargs):
        result = super().serialize_event(event, *args, **kwargs)
        if "transaction.status" in event:
            result.update(
                {
                    "transaction.status": SPAN_STATUS_CODE_TO_NAME.get(
                        event["transaction.status"], "unknown"
                    ),
                }
            )
        result.update(
            {
                "children": [],
                "errors": [],
            }
        )
        return result

    def update_event_extra(self, event, nodestore_data, detailed=False):
        """ Add extra data that we get from Nodestore """
        event.update({event_key: nodestore_data.get(event_key) for event_key in NODESTORE_KEYS})
        if detailed:
            event.update(
                {event_key: nodestore_data.get(event_key) for event_key in DETAILED_NODESTORE_KEYS}
            )
            if "measurements" in nodestore_data:
                event["measurements"] = nodestore_data.get("measurements")
            event["tags"] = {}
            for [tag_key, tag_value] in nodestore_data.get("tags"):
                event["tags"][tag_key] = tag_value

    def update_generations(self, event):
        parents = [event]
        iteration = 0
        while parents and iteration < MAX_TRACE_SIZE:
            iteration += 1
            parent = parents.pop()
            for child in parent["children"]:
                child["generation"] = parent["generation"] + 1
                parents.append(child)

    def serialize(
        self,
        parent_map,
        error_map,
        root,
        warning_extra,
        params,
        snuba_event=None,
        event_id=None,
        detailed=False,
    ):
        """ For the full event trace, we return the results as a graph instead of a flattened list """
        parent_events = {}
        parent_events[root["id"]] = self.serialize_event(root, None, 0)
        # TODO(wmak): Dictionary ordering in py3.6 is an implementation detail, using an OrderedDict because this way
        # we can guarantee in py3.6 that the first item is the root
        # So we can switch back to a normal dict when either the frontend doesn't depend on the root being the first
        # element, or if we're on python 3.7
        results_map = OrderedDict({None: [parent_events[root["id"]]]})

        with sentry_sdk.start_span(op="building.trace", description="full trace"):
            to_check = deque([root])
            iteration = 0
            has_orphans = False
            while parent_map or to_check:
                if len(to_check) == 0:
                    has_orphans = True
                    # Grab any set of events from the parent map
                    parent_span_id, current_events = parent_map.popitem()

                    current_event, *siblings = current_events
                    # If there were any siblings put them back
                    if siblings:
                        parent_map[parent_span_id] = siblings

                    previous_event = parent_events[current_event["id"]] = self.serialize_event(
                        current_event, None, 0
                    )

                    # not using a defaultdict here as a DefaultOrderedDict isn't worth the effort
                    if parent_span_id in results_map:
                        results_map[parent_span_id].append(previous_event)
                    else:
                        results_map[parent_span_id] = [previous_event]
                else:
                    current_event = to_check.popleft()
                    previous_event = parent_events[current_event["id"]]

                # This is faster than doing a call to get_events, since get_event_by_id only makes a call to snuba
                # when non transaction events are included.
                with sentry_sdk.start_span(op="nodestore", description="get_event_by_id"):
                    nodestore_event = eventstore.get_event_by_id(
                        current_event["project.id"], current_event["id"]
                    )

                self.update_event_extra(previous_event, nodestore_event.data, detailed)

                spans = nodestore_event.data.get("spans", [])
                # Need to include the transaction as a span as well
                spans.append({"span_id": previous_event["span_id"]})

                for child in spans:
                    if child["span_id"] in error_map:
                        previous_event["errors"].extend(error_map.pop(child["span_id"]))
                    # We need to connect back to an existing orphan trace
                    if has_orphans and child["span_id"] in results_map:
                        previous_event["children"].extend(results_map.pop(child["span_id"]))
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
                    sentry_sdk.set_tag("discover.trace-view.warning", "surpassed-trace-limit")
                    logger.warning(
                        "discover.trace-view.surpassed-trace-limit",
                        extra=warning_extra,
                    )
                    break

        results = []
        for result in results_map.values():
            # Only need to update generation values when there are orphans since otherwise we stepped through in order
            if has_orphans:
                for root in result:
                    self.update_generations(root)
            results.extend(result)
        return results
