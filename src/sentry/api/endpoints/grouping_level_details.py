import datetime
import logging

from rest_framework.exceptions import APIException
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.query import Column, Entity, Function, Query

from sentry.api.bases import GroupEndpoint
from sentry.api.endpoints.grouping_levels import LevelsOverview, check_feature, get_levels_overview
from sentry.models import Group, GroupHash
from sentry.tasks.unmerge import unmerge
from sentry.unmerge import HierarchicalUnmergeReplacement
from sentry.utils import snuba

logger = logging.getLogger(__name__)


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
        assume_source_emptied=True,
        reset_hashes=[],
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

    # Create new group with parent hash that we want to group by going forward.
    destination = Group.objects.create(
        project_id=group.project_id, short_id=group.project.next_short_id()
    )

    GroupHash.objects.create_or_update(
        project_id=group.project_id,
        hash=new_materialized_hash,
        defaults={"group_id": destination.id},
    )

    now = datetime.datetime.now()

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
                Condition(Column("timestamp"), Op.GTE, now - datetime.timedelta(days=90)),
                Condition(Column("timestamp"), Op.LT, now + datetime.timedelta(seconds=10)),
            ]
        )
    )

    # TODO pagination
    for row in snuba.raw_snql_query(
        query, referrer="api.grouping_levels_details.decrease_level.get_group_ids"
    )["data"]:
        group_id = row["group_id"]

        replacement = HierarchicalUnmergeReplacement(
            primary_hash=levels_overview.only_primary_hash,
            filter_hierarchical_hash=new_materialized_hash,
            filter_level=id,
            new_level=id,
            assume_source_emptied=False,
            # Reset SPLIT state of entire subtree. At this point new events should go
            # into the just-created group.
            reset_hashes=row["reset_hashes"],
        )

        unmerge.delay(
            project_id=group.project_id,
            source_id=group_id,
            destination_id=None,
            destinations={new_materialized_hash: (destination.id, None)},
            fingerprints=None,
            actor_id=request.user.id if request.user else None,
            replacement=replacement,
        )
