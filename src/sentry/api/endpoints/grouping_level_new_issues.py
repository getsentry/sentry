import datetime

from django.core.cache import cache
from snuba_sdk.conditions import Condition, Op
from snuba_sdk.orderby import Direction, OrderBy
from snuba_sdk.query import Column, Entity, Function, Query

from sentry import nodestore
from sentry.api.bases import GroupEndpoint
from sentry.api.endpoints.group_hashes_split import _get_group_filters
from sentry.api.endpoints.grouping_levels import LevelsOverview, check_feature, get_levels_overview
from sentry.api.paginator import GenericOffsetPaginator
from sentry.api.serializers import EventSerializer, serialize
from sentry.event_manager import get_event_type
from sentry.eventstore.models import Event
from sentry.models import Group
from sentry.utils import snuba
from sentry.utils.safe import get_path


class GroupingLevelNewIssuesEndpoint(GroupEndpoint):
    def get(self, request, id: str, group: Group):
        """
        Retrieve information about a particular grouping level, including a
        list of issues it would create.

        ```
        GET /api/0/issues/<group_id>/grouping/levels/<level_id>/new-issues/

        [
            {"hash": "...", "latestEvent": ..., "eventCount": 132},
            ...
        ]
        ```

        Available level IDs can be fetched from `GroupingLevelsEndpoint`.

        Each row/array item corresponds to one *new issue* that selecting this
        level would create in place of the *affected issues*. The array items
        are not groups, but groups that will be created, therefore a lot of
        information normally available for groups is missing.

        - `latestEvent`: a sample event in the same format returned by the
          event details endpoint(s).

        - `hash`: The grouping hash, probably insignificant to the user but can
          be shown for diagnostic purposes.

        - `eventCount`: How many events this issue would contain. Note that
          like with any other event count, this number can change all the time
          because events keep coming in.

        The "would-be issues" are returned in-order such that the most recently
        seen "issue" is at the top, i.e. it is sorted in descending order of
        `latestEvent.dateCreated`.

        The *affected issue* (=to-be-deleted issue) is often just the current one,
        however if the previewed grouping level is reduced, this endpoint can
        return a list of entries which together have more events than the
        current issue (meaning issues will be merged together).

        In the future there will be an endpoint that allows you to fetch the
        list of affected issues. For now the UI should simply show a warning if
        the level is decreased (and possibly only if the summed up events of
        the new issues are more than what the current issue has).
        """

        check_feature(group.project.organization, request)

        parsed_id = int(id)

        def data_fn(offset=None, limit=None):
            return _query_snuba(group, parsed_id, offset=offset, limit=limit)

        def on_results(results):
            return _process_snuba_results(results, group, parsed_id, request.user)

        return self.paginate(
            request=request,
            on_results=on_results,
            paginator=GenericOffsetPaginator(data_fn=data_fn),
        )


def _get_hash_for_parent_level(group: Group, id: int, levels_overview: LevelsOverview) -> str:
    # If this is violated, there cannot be a 1:1 mapping between level and hash.
    assert 0 <= id < levels_overview.current_level

    # This cache never needs explicit invalidation because during every level
    # change, the group ID changes.
    #
    # No idea if the query is slow, caching just because I can.
    cache_key = f"group-parent-level-hash:{group.id}:{id}"

    return_hash: str = cache.get(cache_key)

    if return_hash is None:
        query = (
            Query("events", Entity("events"))
            .set_select([Function("arrayElement", [Column("hierarchical_hashes"), id + 1], "hash")])
            .set_where(_get_group_filters(group))
            .set_limit(1)
        )

        return_hash: str = get_path(snuba.raw_snql_query(query), "data", 0, "hash")  # type: ignore
        cache.set(cache_key, return_hash)

    assert return_hash
    return return_hash


def _query_snuba(group: Group, id: int, offset=None, limit=None):
    query = (
        Query("events", Entity("events"))
        .set_select(
            [
                Function(
                    "arrayElement",
                    [
                        Column("hierarchical_hashes"),
                        Function(
                            "least", [id + 1, Function("length", [Column("hierarchical_hashes")])]
                        ),
                    ],
                    "new_materialized_hash",
                ),
                Function("argMax", [Column("event_id"), Column("timestamp")], "latest_event_id"),
                Function("max", [Column("timestamp")], "latest_event_timestamp"),
                Function("count", [], "event_count"),
            ]
        )
        .set_groupby([Column("new_materialized_hash")])
        .set_orderby(
            [
                OrderBy(Column("event_count"), Direction.DESC),
                # Completely useless sorting key, only there to achieve stable sort
                # order in tests.
                OrderBy(Column("latest_event_timestamp"), Direction.DESC),
            ]
        )
    )

    levels_overview = get_levels_overview(group)

    # These conditions are always valid
    common_where = [
        Condition(Column("primary_hash"), Op.EQ, levels_overview.only_primary_hash),
        Condition(Column("project_id"), Op.EQ, group.project_id),
    ]

    if id >= levels_overview.current_level:
        # Good path: Since we increase the level we can easily constrain the
        # entire query by group_id and timerange
        query = query.set_where(common_where + _get_group_filters(group))
    else:
        # Bad path: We decreased the level and now we need to count events from
        # other groups. If we cannot filter by group_id, we can also not
        # restrict the timerange to anything at all. The Snuba API still
        # requires us to set a timerange, so we set it to the maximum of 90d.
        #
        # Luckily the minmax index on group_id alone is reasonably efficient so
        # that filtering by timerange (=primary key) is only a little bit
        # faster.
        now = datetime.datetime.now()
        new_materialized_hash = _get_hash_for_parent_level(group, id, levels_overview)
        query = query.set_where(
            common_where
            + [
                Condition(
                    Function("arrayElement", [Column("hierarchical_hashes"), id + 1]),
                    Op.EQ,
                    new_materialized_hash,
                ),
                Condition(Column("timestamp"), Op.GTE, now - datetime.timedelta(days=90)),
                Condition(Column("timestamp"), Op.LT, now + datetime.timedelta(seconds=10)),
            ]
        )

    if offset is not None:
        query = query.set_offset(offset)

    if limit is not None:
        query = query.set_limit(limit)

    return snuba.raw_snql_query(query, referrer="api.group_hashes_levels.get_level_new_issues")[
        "data"
    ]


def _process_snuba_results(query_res, group: Group, id: int, user):
    event_ids = {
        row["latest_event_id"]: Event.generate_node_id(group.project_id, row["latest_event_id"])
        for row in query_res
    }

    node_data = nodestore.get_multi(list(event_ids.values()))

    response = []

    for row in query_res:
        response_item = {
            "hash": row["new_materialized_hash"],
            "eventCount": row["event_count"],
        }
        event_id = row["latest_event_id"]
        event_data = node_data.get(event_ids[event_id], None)

        if event_data is not None:
            event = Event(group.project_id, event_id, group_id=group.id, data=event_data)
            response_item["latestEvent"] = serialize(event, user, EventSerializer())

            tree_label = get_path(event_data, "hierarchical_tree_labels", id) or get_path(
                event_data, "hierarchical_tree_labels", -1
            )

            # Rough approximation of what happens with Group title
            event_type = get_event_type(event.data)
            metadata = dict(event.get_event_metadata())
            metadata["current_tree_label"] = tree_label
            # Force rendering of grouping tree labels irrespective of platform
            metadata["display_title_with_tree_label"] = True
            title = event_type.get_title(metadata)
            response_item["title"] = title or event.title
            response_item["metadata"] = metadata

        response.append(response_item)

    return response
