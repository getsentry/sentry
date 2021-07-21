from dataclasses import dataclass

from snuba_sdk.query import Column, Entity, Function, Query

from sentry import features
from sentry.api.bases import GroupEndpoint
from sentry.api.endpoints.group_hashes_split import _construct_arraymax, _get_group_filters
from sentry.api.exceptions import SentryAPIException, status
from sentry.grouping.api import get_grouping_config_dict_for_project, load_grouping_config
from sentry.models import Group, GroupHash
from sentry.utils import snuba


class NoEvents(SentryAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    code = "no_events"
    message = "This issue has no events."


class MergedIssues(SentryAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    code = "merged_issues"
    message = "The issue can only contain one fingerprint. It needs to be fully unmerged before grouping levels can be shown."


class MissingFeature(SentryAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    code = "missing_feature"
    message = "This project does not have the grouping tree feature."


class IssueNotHierarchical(SentryAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    code = "issue_not_hierarchical"
    message = "This issue does not have hierarchical grouping."


class ProjectNotHierarchical(SentryAPIException):
    status_code = status.HTTP_403_FORBIDDEN
    code = "project_not_hierarchical"
    message = "This project does not have hierarchical grouping."


class GroupingLevelsEndpoint(GroupEndpoint):
    def get(self, request, group: Group):
        """
        Return the available levels for this group.

        ```
        GET /api/0/issues/123/grouping/levels/

        {"levels": [{"id": "0", "isCurrent": true}, {"id": "1"}, {"id": "2"}]}
        ```

        `isCurrent` is the currently applied level that the server groups by.
        It cannot be reapplied.

        The levels are returned in-order, such that the first level produces
        the least amount of issues, and the last level the most amount.

        The IDs correspond to array indices in the underlying ClickHouse column
        and are parseable as integers, but this must be treated as
        implementation detail. Clients should pass IDs around as opaque
        strings.

        A single `id` can be passed as part of the URL to
        `GroupingLevelNewIssuesEndpoint`.

        Returns a 403 if grouping levels are unavailable or the required
        featureflags are missing.
        """

        check_feature(group.project.organization, request)

        return self.respond(_list_levels(group), status=200)


def check_feature(organization, request):
    if not features.has("organizations:grouping-tree-ui", organization, actor=request.user):
        raise MissingFeature()


def _current_level_expr(group):
    materialized_hashes = {
        gh.hash for gh in GroupHash.objects.filter(project=group.project, group=group)
    }

    # Evaluates to the index of the last hash that is in materialized_hashes,
    # or 1 otherwise.
    find_hash_expr = _construct_arraymax(
        [1]
        + [  # type: ignore
            Function("indexOf", [Column("hierarchical_hashes"), hash])
            for hash in materialized_hashes
        ]
    )

    return Function("max", [find_hash_expr], "current_level")


@dataclass
class LevelsOverview:
    current_level: int
    only_primary_hash: str
    num_levels: int


def get_levels_overview(group):
    query = (
        Query("events", Entity("events"))
        .set_select(
            [
                Column("primary_hash"),
                Function(
                    "max", [Function("length", [Column("hierarchical_hashes")])], "num_levels"
                ),
                _current_level_expr(group),
            ]
        )
        .set_where(_get_group_filters(group))
        .set_groupby([Column("primary_hash")])
    )

    res = snuba.raw_snql_query(query, referrer="api.group_hashes_levels.get_levels_overview")

    if not res["data"]:
        raise NoEvents()

    if len(res["data"]) > 1:
        raise MergedIssues()

    assert len(res["data"]) == 1

    fields = res["data"][0]

    if fields["num_levels"] <= 0:
        if not _project_has_hierarchical_grouping(group.project):
            raise ProjectNotHierarchical()
        raise IssueNotHierarchical()

    # TODO: Cache this if it takes too long. This is called from multiple
    # places, grouping overview and then again in the new-issues endpoint.

    return LevelsOverview(
        current_level=fields["current_level"] - 1,
        only_primary_hash=fields["primary_hash"],
        num_levels=fields["num_levels"],
    )


def _list_levels(group):
    fields = get_levels_overview(group)

    # It is a little silly to transfer a list of integers rather than just
    # giving the UI a range, but in the future we may want to add
    # additional fields to each level.
    levels = [{"id": i} for i in range(fields.num_levels)]

    current_level = fields.current_level
    assert levels[current_level]["id"] == current_level
    levels[current_level]["isCurrent"] = True
    return {"levels": levels}


def _project_has_hierarchical_grouping(project):
    config_dict = get_grouping_config_dict_for_project(project)
    config = load_grouping_config(config_dict)
    return config.initial_context["hierarchical_grouping"]
