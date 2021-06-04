import logging

from rest_framework.exceptions import APIException

from sentry.api.bases import GroupEndpoint
from sentry.api.endpoints.grouping_levels import LevelsOverview, check_feature, get_levels_overview
from sentry.models import Group, GroupHash
from sentry.tasks.unmerge import unmerge
from sentry.unmerge import HierarchicalUnmergeReplacement

logger = logging.getLogger(__name__)


class InvalidLevel(APIException):
    status_code = 404
    default_detail = "No such level."
    default_code = "no_level"


class GroupingLevelDetailsEndpoint(GroupEndpoint):
    def post(self, request, id: str, group: Group):
        """
        Set the current grouping level to the given one.

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
            raise NotImplementedError()

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
        current_hierarchical_hash=levels_overview.current_hash,
        current_level=levels_overview.current_level,
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
