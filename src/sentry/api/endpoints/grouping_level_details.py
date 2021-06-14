import datetime
import itertools
import logging
from uuid import uuid4

from django.db import transaction
from rest_framework.exceptions import APIException
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.query import Column, Entity, Function, Query

from sentry import eventstream
from sentry.api.bases import GroupEndpoint
from sentry.api.endpoints.grouping_levels import (
    LevelsOverview,
    MergedIssues,
    check_feature,
    get_levels_overview,
)
from sentry.models import Activity, Group, GroupHash, GroupStatus
from sentry.tasks.merge import merge_groups
from sentry.tasks.unmerge import unmerge
from sentry.unmerge import HierarchicalUnmergeReplacement
from sentry.utils import snuba

logger = logging.getLogger(__name__)


def _bogus_timestamp_conditions():
    """
    Use these if you know you can't use a timestamp limit.
    """
    now = datetime.datetime.now()

    return [
        Condition(Column("timestamp"), Op.GTE, now - datetime.timedelta(days=90)),
        Condition(Column("timestamp"), Op.LT, now + datetime.timedelta(seconds=10)),
    ]


class InvalidLevel(APIException):
    status_code = 404
    default_detail = "No such level."
    default_code = "no_level"


class GroupingLevelDetailsEndpoint(GroupEndpoint):
    def post(self, request, id: str, group: Group):
        """
        Set the current grouping level to the given one.

        ```
        POST /api/0/issues/<group_id>/grouping/levels/<level_id>/

        200 OK
        ```

        Use `GroupingLevelNewIssuesEndpoint` to preview what will be produced
        in place of the current issue.

        No arguments or request data necessary, everything the backend needs to
        know is in the URL.

        Like with merge/unmerge, a status code of 2xx only means the update has
        been started, it will take a couple seconds to observe the effect. No
        read-your-writes here.
        """

        check_feature(group.project.organization, request)

        parsed_id = int(id)
        levels_overview = get_levels_overview(group)

        if parsed_id >= levels_overview.num_levels or parsed_id < 0:
            raise InvalidLevel()

        if parsed_id < levels_overview.current_level:
            _decrease_level(group, parsed_id, levels_overview, request)

        if parsed_id > levels_overview.current_level:
            _increase_level(group, parsed_id, levels_overview, request)

        return self.respond(status=200)


def _increase_level(group: Group, id: int, levels_overview: LevelsOverview, request):
    for other_group_id, state in GroupHash.objects.filter(
        project_id=group.project_id, hash__in=levels_overview.parent_hashes
    ).values_list("group_id", "state"):
        if other_group_id is not None and state != GroupHash.State.SPLIT:
            logger.error("grouping_levels.stacked_groups", extra={"group_id": group.id})

    # Mark one hierarchical hash as SPLIT. Note this also prevents it from
    # being deleted in group deletion.
    #
    # We're upserting the hash here to make sure it exists. We have
    # observed that the materialized hash in postgres is mysteriously lost,
    # presumably because of secondary grouping or merge/unmerge.
    grouphash, _created = GroupHash.objects.get_or_create(
        project_id=group.project_id, hash=levels_overview.current_hash
    )
    grouphash.state = GroupHash.State.SPLIT
    grouphash.group_id = None
    grouphash.save()

    replacement = HierarchicalUnmergeReplacement(
        primary_hash=levels_overview.only_primary_hash,
        filter_hierarchical_hash=levels_overview.current_hash,
        filter_level=levels_overview.current_level,
        new_level=id,
    )

    unmerge.delay(
        project_id=group.project_id,
        source_id=group.id,
        destination_id=None,
        fingerprints=None,
        actor_id=request.user.id if request.user else None,
        replacement=replacement,
    )


def _decrease_level(group: Group, id: int, levels_overview: LevelsOverview, request):
    assert levels_overview.parent_hashes
    assert id < len(levels_overview.parent_hashes)

    new_materialized_hash = levels_overview.parent_hashes[id]

    timerange = _bogus_timestamp_conditions()

    # When decreasing the level, events from this + other groups get merged
    # into one new parent group. This is why we cannot restrict the query by
    # timestamp here. The query logic is analoguous to
    # GroupingLevelNewIssuesEndpoint.

    query = (
        Query("events", Entity("events"))
        .set_select(
            [
                Column("group_id"),
                Function(
                    "argMax",
                    [
                        Function(
                            "arraySlice",
                            [
                                Column("hierarchical_hashes"),
                                id + 1,
                            ],
                        ),
                        Column("timestamp"),
                    ],
                    "reset_hashes",
                ),
            ]
        )
        .set_groupby([Column("group_id")])
        .set_where(
            [
                Condition(Column("primary_hash"), Op.EQ, levels_overview.only_primary_hash),
                Condition(Column("project_id"), Op.EQ, group.project_id),
                Condition(
                    Function("arrayElement", [Column("hierarchical_hashes"), id + 1]),
                    Op.EQ,
                    new_materialized_hash,
                ),
            ]
            + timerange
        )
    )

    # TODO pagination
    # We expect this query to return <200 results, so this should still be
    # acceptable especially considering the loop body is fast.
    #
    # If we move this into a paginating celery task we need to consider that
    # we're iterating over a table that is also modified by the unmerge task at
    # the same time.
    group_ids_result = snuba.raw_snql_query(
        query, referrer="api.grouping_levels_details.decrease_level.get_group_ids"
    )["data"]
    source_group_ids = [row["group_id"] for row in group_ids_result]

    # This query only serves the purpose if any of the to-be-merged groups
    # contain merged issues.
    query = (
        Query("events", Entity("events"))
        .set_select([Function("uniqExact", [Column("primary_hash")], "count_primary_hash")])
        .set_where(
            [
                Condition(Column("project_id"), Op.EQ, group.project_id),
                Condition(Column("group_id"), Op.IN, source_group_ids),
            ]
            + timerange
        )
        .set_groupby([Column("group_id")])
        .set_having([Condition(Column("count_primary_hash"), Op.GT, 1)])
    )

    merged_issues_result = snuba.raw_snql_query(
        query, referrer="api.grouping_levels_details.decrease_level.merged_issues_check"
    )["data"]

    if merged_issues_result:
        raise MergedIssues()

    # Create new group with parent hash that we want to group by going forward.
    GroupHash.objects.get_or_create(
        project_id=group.project_id,
        hash=new_materialized_hash,
    )

    destination = Group.objects.create(
        project_id=group.project_id, short_id=group.project.next_short_id()
    )

    reset_hashes = set(
        itertools.chain.from_iterable(row["reset_hashes"] for row in group_ids_result)
    )

    # Disassociate all subhashes and reset their state, except for the one
    # hierarchical hash that we now group by (new_materialized_hash).
    with transaction.atomic():
        locked_grouphashes = GroupHash.objects.filter(
            project_id=group.project_id, hash__in=reset_hashes
        ).select_for_update()
        ids = [gh.id for gh in locked_grouphashes]
        GroupHash.objects.filter(id__in=ids).exclude(hash=new_materialized_hash).update(
            state=GroupHash.State.UNLOCKED, group_id=None
        )
        GroupHash.objects.filter(id__in=ids, hash=new_materialized_hash).update(
            state=GroupHash.State.UNLOCKED, group_id=destination.id
        )

    Group.objects.filter(id__in=source_group_ids).update(status=GroupStatus.PENDING_MERGE)

    eventstream_state = eventstream.start_merge(
        destination.project_id, source_group_ids, destination.id
    )

    transaction_id = uuid4().hex

    merge_groups.delay(
        from_object_ids=source_group_ids,
        to_object_id=destination.id,
        transaction_id=transaction_id,
        eventstream_state=eventstream_state,
    )

    Activity.objects.create(
        project=destination.project,
        group=destination,
        type=Activity.MERGE,
        user=request.user,
        data={"issues": [{"id": id} for id in source_group_ids]},
    )
