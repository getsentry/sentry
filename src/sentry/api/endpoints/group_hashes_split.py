import datetime
from typing import Any, Dict, List, Optional, Sequence

import sentry_sdk
from django.db import transaction
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.orderby import Direction, OrderBy
from snuba_sdk.query import Column, Entity, Function, Query

from sentry import eventstore, features
from sentry.api.bases import GroupEndpoint
from sentry.api.serializers import EventSerializer, serialize
from sentry.grouping.variants import ComponentVariant
from sentry.models import Group, GroupHash
from sentry.utils import snuba


class GroupHashesSplitEndpoint(GroupEndpoint):
    def get(self, request, group):
        """
        Return information on whether the group can be split up, has been split
        up and what it will be split up into.

        In the future this endpoint should supersede the GET on grouphashes
        endpoint.
        """

        return self.respond(_render_trees(group, request.user), status=200)

    def put(self, request, group):
        """
        Split up a group into subgroups
        ```````````````````````````````

        If a group is split up using this endpoint, new events that would have
        been associated with this group will instead create 1..n new, more
        "specific" groups according to their hierarchical group hashes.

        For example, let's say you have a group containing all events whose
        crashing frame was `log_error`, i.e. events are only grouped by one
        frame. This is not a very descriptive frame to group by. If this
        endpoint is hit, new events that crash in `log_error` will be sorted
        into groups that hash by `log_error` and the next (calling) frame.

        In the future this endpoint will move existing events into the new,
        right groups.

        :pparam string issue_id: the ID of the issue to split up.
        :auth: required
        """

        if not features.has(
            "organizations:grouping-tree-ui", group.project.organization, actor=request.user
        ):

            return self.respond(
                {"error": "This project does not have the grouping tree feature"},
                status=404,
            )

        hashes = request.GET.getlist("id")
        for hash in hashes:
            if not isinstance(hash, str) or len(hash) != 32:
                return self.respond({"error": "hash does not look like a grouphash"}, status=400)

        for hash in hashes:
            _split_group(group, hash)

        return self.respond(status=200)

    def delete(self, request, group):
        """
        Un-split group(s) into their parent group
        `````````````````````````````````````````

        This basically undoes the split operation one can do with PUT on this
        endpoint. Note that this API is not very RESTful: The group referenced
        here is one of the subgroups created rather than the group that was
        split up.

        When unsplitting, all other child groups are left intact and can be
        merged into the parent via regular issue merge.

        In the future this endpoint will, much like for PUT, move existing
        events of the referenced group into the parent group.

        :pparam string issue_id: the ID of the issue to split up.
        :auth: required
        """

        if not features.has(
            "organizations:grouping-tree-ui", group.project.organization, actor=request.user
        ):

            return self.respond(
                {"error": "This project does not have the grouping tree feature"},
                status=404,
            )

        hashes = request.GET.getlist("id")
        for hash in hashes:
            if not isinstance(hash, str) or len(hash) != 32:
                return self.respond({"error": "hash does not look like a grouphash"}, status=400)

        for hash in hashes:
            _unsplit_group(group, hash)

        return self.respond(status=200)


class NoHierarchicalHash(Exception):
    pass


def _split_group(group: Group, hash: str, hierarchical_hashes: Optional[Sequence[str]] = None):
    # Sanity check to see if what we're splitting here is a hierarchical hash.
    if hierarchical_hashes is None:
        hierarchical_hashes = _get_full_hierarchical_hashes(group, hash)

    if not hierarchical_hashes:
        raise NoHierarchicalHash()

    # Mark one hierarchical hash as SPLIT. Note this also prevents it from
    # being deleted in group deletion.
    #
    # We're upserting the hash here to make sure it exists. We have observed
    # that the materialized hash in postgres is mysteriously lost, presumably
    # because of secondary grouping or merge/unmerge.
    grouphash, _created = GroupHash.objects.get_or_create(project_id=group.project_id, hash=hash)
    grouphash.state = GroupHash.State.SPLIT
    grouphash.group_id = group.id
    grouphash.save()


def _get_full_hierarchical_hashes(group: Group, hash: str) -> Optional[Sequence[str]]:
    query = (
        Query("events", Entity("events"))
        .set_select(
            [
                Column("hierarchical_hashes"),
            ]
        )
        .set_where(
            _get_group_filters(group)
            + [
                Condition(
                    Function(
                        "has",
                        [Column("hierarchical_hashes"), hash],
                    ),
                    Op.EQ,
                    1,
                ),
            ]
        )
    )

    data = snuba.raw_snql_query(query, referrer="group_split.get_full_hierarchical_hashes")["data"]
    if not data:
        return None

    return data[0]["hierarchical_hashes"]


def _unsplit_group(group: Group, hash: str, hierarchical_hashes: Optional[Sequence[str]] = None):
    if hierarchical_hashes is None:
        hierarchical_hashes = _get_full_hierarchical_hashes(group, hash)

    if not hierarchical_hashes:
        raise NoHierarchicalHash()

    hierarchical_grouphashes = {
        grouphash.hash: grouphash
        for grouphash in GroupHash.objects.filter(
            project=group.project, hash__in=hierarchical_hashes
        )
    }

    grouphash_to_unsplit = None
    grouphash_to_delete = None

    # Only un-split one grouphash such that issue grouping only moves up only
    # one level of the tree.

    for hash in hierarchical_hashes:
        grouphash = hierarchical_grouphashes.get(hash)
        if grouphash is None:
            continue

        if grouphash.state == GroupHash.State.SPLIT:
            grouphash_to_unsplit = grouphash

        if grouphash.group_id == group.id:
            grouphash_to_delete = grouphash

    with transaction.atomic():
        if grouphash_to_unsplit is not None:
            grouphash_to_unsplit.state = GroupHash.State.UNLOCKED
            grouphash_to_unsplit.save()

        if grouphash_to_delete is not None:
            grouphash_to_delete.delete()


def _get_group_filters(group: Group):
    return [
        Condition(Column("project_id"), Op.EQ, group.project_id),
        Condition(Column("group_id"), Op.EQ, group.id),
        # XXX(markus): Those conditions are subject to last_seen being totally
        # in sync with max(timestamp) of Snuba which can be false. In fact we
        # know that during merge/unmerge last_seen can become permanently
        # wrong: https://github.com/getsentry/sentry/issues/25673
        #
        # We add both conditions because Snuba query API requires us to, and
        # because it does bring a significant performance boost.
        Condition(Column("timestamp"), Op.GTE, group.first_seen),
        Condition(Column("timestamp"), Op.LT, group.last_seen + datetime.timedelta(seconds=1)),
    ]


def _add_hash(
    trees: List[Dict[str, Any]],
    project_id: int,
    user,
    parent_hash: Optional[str],
    hash: str,
    child_hash: Optional[str],
    event_count: int,
    last_seen,
    latest_event_id,
):
    event = eventstore.get_event_by_id(project_id, latest_event_id)

    tree = {
        "parentId": parent_hash,
        "id": hash,
        "childId": child_hash,
        "eventCount": event_count,
        "latestEvent": serialize(event, user, EventSerializer()),
    }

    trees.append(tree)

    try:
        for variant in event.get_grouping_variants().values():
            if not isinstance(variant, ComponentVariant):
                continue

            if variant.get_hash() == tree["parentId"]:
                tree["parentLabel"] = variant.component.tree_label

            if variant.get_hash() == tree["id"]:
                tree["label"] = variant.component.tree_label

            if variant.get_hash() == tree["childId"]:
                tree["childLabel"] = variant.component.tree_label

    except Exception:
        sentry_sdk.capture_exception()


def _construct_arraymax(elements):
    # XXX(markus): This is quite horrible but Snuba SDK does not allow us to do
    # arrayMax([<other function call>, ...]), i.e. it does not allow function
    # calls in array literals. So instead of arrayMax([1, 2, 3]) we do
    # greatest(1, greatest(2, 3)).
    assert elements

    if len(elements) == 1:
        return elements[0]

    # Attempt to build well-balanced 'tree' of greatest() such that
    # we don't run into ClickHouse recursion limits.

    return Function(
        "greatest",
        [
            _construct_arraymax(elements[: len(elements) // 2]),
            _construct_arraymax(elements[len(elements) // 2 :]),
        ],
    )


def _render_trees(group: Group, user):
    materialized_hashes = list(
        {gh.hash for gh in GroupHash.objects.filter(project=group.project, group=group)}
    )

    # Evaluates to the index of the last hash that is in materialized_hashes,
    # or 1 otherwise.
    find_hash_expr = _construct_arraymax(
        [1]
        + [  # type: ignore
            Function("indexOf", [Column("hierarchical_hashes"), hash])
            for hash in materialized_hashes
        ]
    )

    # After much deliberation I (markus) decided that it would be best to
    # render the entire tree using one large Snuba query. A previous
    # implementation incurred n+1 queries on Snuba (n = number of materialized
    # hashes) and was very buggy when it came to missing materialized hashes
    # (which can happen if fallback/secondary grouping is turned on), events
    # were counted twice because those n+1 queries accidentally counted
    # overlapping sets of events, and the endpoint response time was kind of
    # bad because of n+1 query.
    #
    # It being one large query may also make it easier to add pagination down
    # the road.

    query = (
        Query("events", Entity("events"))
        .set_select(
            [
                Function("count", [], "event_count"),
                Function("argMax", [Column("event_id"), Column("timestamp")], "event_id"),
                Function("max", [Column("timestamp")], "latest_event_timestamp"),
                # If hierarchical_hashes contains any of the materialized
                # hashes, find_hash_expr evaluates to the last found index and
                # arraySlice will give us this hash + the next child hash that
                # we use in groupby
                #
                # If hierarchical_hashes does not contain any of those hashes,
                # find_hash_expr will return 1 so we start slicing at the beginning.
                # This can happen when hierarchical_hashes is empty (=>
                # hash_slice = []), but we also try to recover gracefully from
                # a hypothetical case where we are missing some hashes in
                # postgres (unclear how this could be reached).
                #
                # We select some intermediate computation values here which we
                # definetly don't need the results of. It's just temp vars.
                Function(
                    # First we find the materialized hash using find_hash_expr,
                    # and subtract 1 which should be the parent hash if there
                    # is one. If there isn't, this now can be an out-of-bounds
                    # access by being 0 (arrays are indexed starting with 1)
                    "minus",
                    [find_hash_expr, 1],
                    "parent_hash_i",
                ),
                # We clip the value to be at least 1, this will be where we
                # start slicing hierarchical_hashes. 0 would be an out of
                # bounds access.
                Function("greatest", [Column("parent_hash_i"), 1], "slice_start"),
                # This will return a slice of length 2 if the materialized hash
                # has been found at the beginning of the array, but return a
                # slice of length 3 if not.
                Function(
                    "arraySlice",
                    [
                        Column("hierarchical_hashes"),
                        Column("slice_start"),
                        Function(
                            "minus",
                            [
                                Function(
                                    "plus",
                                    [Column("parent_hash_i"), 3],
                                ),
                                Column("slice_start"),
                            ],
                        ),
                    ],
                    "hash_slice",
                ),
                Column("primary_hash"),
            ]
        )
        .set_where(_get_group_filters(group))
        .set_groupby(
            [
                Column("parent_hash_i"),
                Column("slice_start"),
                Column("hash_slice"),
                Column("primary_hash"),
            ]
        )
        .set_orderby([OrderBy(Column("latest_event_timestamp"), Direction.DESC)])
    )

    rv = []

    for row in snuba.raw_snql_query(query, referrer="api.group_split.render_grouping_tree")["data"]:
        if len(row["hash_slice"]) == 0:
            hash = row["primary_hash"]
            parent_hash = child_hash = None
        elif len(row["hash_slice"]) == 1:
            (hash,) = row["hash_slice"]
            parent_hash = child_hash = None
        elif len(row["hash_slice"]) == 2:
            hash, child_hash = row["hash_slice"]
            parent_hash = None
        elif len(row["hash_slice"]) == 3:
            parent_hash, hash, child_hash = row["hash_slice"]
        else:
            raise ValueError("unexpected length of hash_slice")

        _add_hash(
            rv,
            group.project_id,
            user,
            parent_hash,
            hash,
            child_hash,
            row["event_count"],
            row["latest_event_timestamp"],
            row["event_id"],
        )

    rv.sort(key=lambda tree: (tree["id"] or "", tree["childId"] or ""))

    return rv
