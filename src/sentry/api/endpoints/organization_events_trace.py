import logging
import sentry_sdk

from collections import defaultdict, deque, OrderedDict

from django.http import Http404
from rest_framework.response import Response

from sentry import features, eventstore
from sentry.api.bases import OrganizationEventsV2EndpointBase, NoProjects
from sentry.snuba import discover
from sentry.models import Group
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME


logger = logging.getLogger(__name__)
MAX_TRACE_SIZE = 100
NODESTORE_KEYS = ["timestamp", "start_timestamp"]
ERROR_COLUMNS = [
    "id",
    "project",
    "timestamp",
    "trace.span",
    "transaction",
    "issue",
]


def find_event(items, function, default=None):
    return next(filter(function, items), default)


def is_root(item):
    return item.get("root", "0") == "1"


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
            "errors": [],
        }

    def serialize_error(self, event):
        return {
            "event_id": event["id"],
            "span": event["trace.span"],
            "project_id": event["project.id"],
            "project_slug": event["project"],
            "url": event["url"],
        }

    def construct_span_map(self, events, key):
        """A mapping of span ids to their events

        key depends on the event type:
        - Errors are associated to transactions via span_id
        - Transactions are associated to each other via parent_span_id
        """
        parent_map = defaultdict(list)
        for item in events:
            if not is_root(item):
                parent_map[item[key]].append(item)
        return parent_map

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
            sentry_sdk.set_tag("discover.trace-view.num_transactions", len_transactions)
            sentry_sdk.set_tag(
                "discover.trace-view.num_transactions.grouped",
                "<10" if len_transactions < 10 else "<100" if len_transactions < 100 else ">100",
            )

        warning_extra = {"trace": trace_id, "organization": organization}

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

        # Temporarily feature flagging this out, since errors will impact performance
        if not features.has("organizations:trace-view-summary", organization, actor=request.user):
            errors = []
        else:
            current_transaction = find_event(result["data"], lambda t: t["id"] == event_id)
            errors = self.get_errors(organization, trace_id, params, current_transaction, event_id)
            if errors:
                groups = {
                    group.id: group
                    for group in Group.objects.filter(
                        id__in=[row["issue.id"] for row in errors],
                        project_id__in=params.get("project_id", []),
                        project__organization=organization,
                    )
                }
                for row in errors:
                    row["url"] = groups[row["issue.id"]].get_absolute_url(
                        organization_slug=organization.slug
                    )

        return Response(
            self.serialize(result["data"], errors, root, warning_extra, event_id, detailed)
        )


class OrganizationEventsTraceLightEndpoint(OrganizationEventsTraceEndpointBase):
    def get_current_transaction(self, transactions, errors, event_id):
        """Given an event_id return the related transaction event

        The event_id could be for an error, since we show the quick-trace
        for both event types
        We occasionally have to get the nodestore data, so this function returns
        the nodestore event as well so that we're doing that in one location.
        """
        transaction_event = find_event(transactions, lambda item: item["id"] == event_id)
        if transaction_event is not None:
            return transaction_event, eventstore.get_event_by_id(
                transaction_event["project.id"], transaction_event["id"]
            )

        # The event couldn't be found, it might be an error
        error_event = find_event(errors, lambda item: item["id"] == event_id)
        # Alright so we're looking at an error, time to see if we can find its transaction
        if error_event:
            # Unfortunately the only association from an event back to its transaction is name & span_id
            # First maybe we got lucky and the error happened on the transaction's "span"
            transaction_event = find_event(
                transactions, lambda item: item["trace.span"] == error_event["trace.span"]
            )
            if transaction_event:
                return transaction_event, eventstore.get_event_by_id(
                    transaction_event["project.id"], transaction_event["id"]
                )
            # We didn't get lucky, time to talk to nodestore...
            for transaction_event in transactions:
                if transaction_event["transaction"] != error_event["transaction"]:
                    continue

                nodestore_event = eventstore.get_event_by_id(
                    transaction_event["project.id"], transaction_event["id"]
                )
                for span in nodestore_event.data.get("spans", []):
                    if span["span_id"] == error_event["trace.span"]:
                        return transaction_event, nodestore_event

        # The current event couldn't be found in errors or transactions
        raise Http404()

    def get_errors(self, organization, trace_id, params, current_event, event_id):
        """Get errors for this trace

        We try to optimize the light view's error retrieval, compared to
        the full trace, so we try to get as few errors as possible
        """
        with sentry_sdk.start_span(op="discover", description="getting trace errors"):
            with self.handle_query_errors():
                # Search for errors for the current event if its a transaction, otherwise look for the exact error
                query_extra = (
                    f"transaction:{current_event['transaction']}"
                    if current_event
                    else f"id:{event_id}"
                )
                # This can't be combined with the transaction query since we need dataset specific fields
                error_results = discover.query(
                    selected_columns=ERROR_COLUMNS,
                    orderby=["-timestamp", "id"],
                    params=params,
                    query=f"!event.type:transaction trace:{trace_id} {query_extra}",
                    limit=MAX_TRACE_SIZE,
                    auto_fields=False,
                    referrer="api.trace-view.get-errors-light",
                )
                return error_results["data"]

    def serialize(
        self,
        transactions,
        errors,
        root,
        warning_extra,
        event_id,
        detailed=False,
    ):
        """ Because the light endpoint could potentially have gaps between root and event we return a flattened list """
        snuba_event, nodestore_event = self.get_current_transaction(transactions, errors, event_id)
        parent_map = self.construct_span_map(transactions, "trace.parent_span")
        error_map = self.construct_span_map(errors, "trace.span")
        trace_results = [self.serialize_event(root, None, 0)]

        with sentry_sdk.start_span(op="building.trace", description="light trace"):
            if root["id"] != snuba_event["id"]:
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

            # The current event should be the last item in the trace_results
            current_event = trace_results[-1]

            spans = nodestore_event.data.get("spans", [])
            # Need to include the transaction as a span as well
            spans.append({"span_id": snuba_event["trace.span"]})

            for span in spans:
                if span["span_id"] in error_map:
                    current_event["errors"].extend(
                        [self.serialize_error(error) for error in error_map.pop(span["span_id"])]
                    )
                if span["span_id"] in parent_map:
                    child_events = parent_map.pop(span["span_id"])
                    trace_results.extend(
                        [
                            self.serialize_event(
                                child_event,
                                snuba_event["id"],
                                (
                                    current_event["generation"] + 1
                                    if current_event["generation"] is not None
                                    else None
                                ),
                            )
                            for child_event in child_events
                        ]
                    )

        return trace_results


class OrganizationEventsTraceEndpoint(OrganizationEventsTraceEndpointBase):
    def get_errors(self, organization, trace_id, params, *args):
        """ Ignores current_event since we get all errors """
        with sentry_sdk.start_span(op="discover", description="getting trace errors"):
            with self.handle_query_errors():
                # This can't be combined with the transaction query since we need dataset specific fields
                error_results = discover.query(
                    selected_columns=ERROR_COLUMNS,
                    orderby=["-timestamp", "id"],
                    params=params,
                    query=f"!event.type:transaction trace:{trace_id}",
                    limit=MAX_TRACE_SIZE,
                    auto_fields=False,
                    referrer="api.trace-view.get-errors",
                )
                return error_results["data"]

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
            }
        )
        return result

    def update_nodestore_extra(self, event, nodestore_data, detailed=False):
        """ Add extra data that we get from Nodestore """
        event.update({event_key: nodestore_data.get(event_key) for event_key in NODESTORE_KEYS})
        if detailed:
            if "measurements" in nodestore_data:
                event["measurements"] = nodestore_data.get("measurements")
            event["tags"] = [
                {
                    "key": tag_key.split("sentry:", 1)[-1],
                    "value": tag_value,
                }
                for [tag_key, tag_value] in sorted(
                    nodestore_data.get("tags"), key=lambda tag: tag[0]
                )
            ]

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
        transactions,
        errors,
        root,
        warning_extra,
        event_id,
        detailed=False,
    ):
        """ For the full event trace, we return the results as a graph instead of a flattened list """
        parent_map = self.construct_span_map(transactions, "trace.parent_span")
        error_map = self.construct_span_map(errors, "trace.span")
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

                self.update_nodestore_extra(previous_event, nodestore_event.data, detailed)

                spans = nodestore_event.data.get("spans", [])
                # Need to include the transaction as a span as well
                spans.append({"span_id": previous_event["span_id"]})

                for child in spans:
                    if child["span_id"] in error_map:
                        previous_event["errors"].extend(
                            [
                                self.serialize_error(error)
                                for error in error_map.pop(child["span_id"])
                            ]
                        )
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
