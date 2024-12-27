from __future__ import annotations

import atexit
import functools
import logging
from abc import ABCMeta, abstractmethod
from collections import defaultdict
from collections.abc import Callable, Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Any

from django.db.models import Q
from django.utils import timezone
from django.utils.functional import SimpleLazyObject

from sentry import features, quotas
from sentry.api.event_search import SearchFilter
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.exceptions import InvalidSearchQuery
from sentry.grouping.types import ErrorGroupType
from sentry.models.environment import Environment
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.grouplink import GroupLink
from sentry.models.groupowner import GroupOwner
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.team import Team
from sentry.search.base import SearchBackend
from sentry.search.events.constants import EQUALITY_OPERATORS, OPERATOR_TO_DJANGO
from sentry.search.snuba.executors import (
    POSTGRES_ONLY_SEARCH_FIELDS,
    AbstractQueryExecutor,
    InvalidQueryForExecutor,
    PostgresSnubaQueryExecutor,
    TrendsSortWeights,
)
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.users.models.user import User
from sentry.utils import metrics
from sentry.utils.cursors import Cursor, CursorResult

logger = logging.getLogger(__name__)


def assigned_to_filter(
    actors: Sequence[User | Team | None], projects: Sequence[Project], field_filter: str = "id"
) -> Q:
    include_none = False
    types_to_actors = defaultdict(list)
    for actor in actors:
        if actor is None:
            include_none = True
        types_to_actors[
            (actor and actor.class_name()) if not isinstance(actor, SimpleLazyObject) else "User"
        ].append(actor)

    query = Q()

    if "Team" in types_to_actors:
        query |= Q(
            **{
                f"{field_filter}__in": GroupAssignee.objects.filter(
                    team__in=types_to_actors["Team"], project_id__in=[p.id for p in projects]
                ).values_list("group_id", flat=True)
            }
        )

    if "User" in types_to_actors:
        users = types_to_actors["User"]
        user_ids: list[int] = [u.id for u in users if u is not None]
        query |= Q(
            **{
                f"{field_filter}__in": GroupAssignee.objects.filter(
                    user_id__in=user_ids, project_id__in=[p.id for p in projects]
                ).values_list("group_id", flat=True)
            }
        )

    if include_none:
        query |= unassigned_filter(True, projects, field_filter=field_filter)
    return query


def unassigned_filter(unassigned: bool, projects: Sequence[Project], field_filter: str = "id") -> Q:
    query = Q(
        **{
            f"{field_filter}__in": GroupAssignee.objects.filter(
                project_id__in=[p.id for p in projects]
            ).values_list("group_id", flat=True)
        }
    )
    if unassigned:
        query = ~query
    return query


def linked_filter(linked: bool, projects: Sequence[Project]) -> Q:
    """
    Builds a filter for whether or not a Group has an issue linked via either
    a PlatformExternalIssue or an ExternalIssue.
    """
    platform_qs = PlatformExternalIssue.objects.filter(project_id__in=[p.id for p in projects])
    integration_qs = GroupLink.objects.filter(
        project_id__in=[p.id for p in projects],
        linked_type=GroupLink.LinkedType.issue,
        relationship=GroupLink.Relationship.references,
    )

    group_linked_to_platform_issue_q = Q(id__in=platform_qs.values_list("group_id", flat=True))
    group_linked_to_integration_issue_q = Q(
        id__in=integration_qs.values_list("group_id", flat=True)
    )

    # Usually a user will either only have PlatformExternalIssues or only have ExternalIssues,
    # i.e. in most cases, at most one of the below expressions evaluates to True:
    platform_issue_exists = platform_qs.exists()
    integration_issue_exists = integration_qs.exists()
    # By optimizing for this case, we're able to produce a filter that roughly translates to
    # `WHERE group_id IN (SELECT group_id FROM one_issue_table WHERE ...)`, which the planner
    # is able to optimize with the semi-join strategy.
    if platform_issue_exists and not integration_issue_exists:
        query = group_linked_to_platform_issue_q
    elif integration_issue_exists and not platform_issue_exists:
        query = group_linked_to_integration_issue_q
    # ...but if we don't have exactly one type of issues, fallback to doing the OR.
    else:
        query = group_linked_to_platform_issue_q | group_linked_to_integration_issue_q

    if not linked:
        query = ~query
    return query


def first_release_all_environments_filter(
    versions: Sequence[str], projects: Sequence[Project]
) -> Q:
    releases: dict[str | None, int] = {
        id_: version
        for id_, version in Release.objects.filter(
            organization=projects[0].organization_id, version__in=versions
        ).values_list("version", "id")
    }
    for version in versions:
        if version not in releases:
            # TODO: This is mostly around for legacy reasons - we should probably just
            # raise a validation here an inform the user that they passed an invalid
            # release
            releases[None] = -1
            # We only need to find the first non-existent release here
            break

        # If no specific environments are supplied, we look at the
        # first_release of any environment that the group has been
        # seen in.
    return Q(first_release_id__in=list(releases.values()))


def inbox_filter(inbox: bool, projects: Sequence[Project]) -> Q:
    query = Q(groupinbox__id__isnull=False)
    if not inbox:
        query = ~query
    else:
        query = query & Q(groupinbox__project_id__in=[p.id for p in projects])
    return query


def assigned_or_suggested_filter(
    owners: Sequence[User | Team | None], projects: Sequence[Project], field_filter: str = "id"
) -> Q:
    organization_id = projects[0].organization_id
    project_ids = [p.id for p in projects]

    types_to_owners = defaultdict(list)
    include_none = False
    for owner in owners:
        if owner is None:
            include_none = True
        types_to_owners[
            (owner and owner.class_name()) if not isinstance(owner, SimpleLazyObject) else "User"
        ].append(owner)

    query = Q()

    if "Team" in types_to_owners:
        teams = types_to_owners["Team"]
        query |= Q(
            **{
                f"{field_filter}__in": GroupOwner.objects.filter(
                    Q(group__assignee_set__isnull=True),
                    team__in=teams,
                    project_id__in=project_ids,
                    organization_id=organization_id,
                )
                .values_list("group_id", flat=True)
                .distinct()
            }
        ) | assigned_to_filter(teams, projects, field_filter=field_filter)

    if "User" in types_to_owners:
        users = types_to_owners["User"]
        user_ids: list[int] = [u.id for u in users if u is not None]
        query_ids = Q(user_id__in=user_ids)
        owned_by_me = Q(
            **{
                f"{field_filter}__in": GroupOwner.objects.filter(
                    query_ids,
                    group__assignee_set__isnull=True,
                    project_id__in=[p.id for p in projects],
                    organization_id=organization_id,
                )
                .values_list("group_id", flat=True)
                .distinct()
            }
        )

        owner_query = owned_by_me | assigned_to_filter(users, projects, field_filter=field_filter)

        query |= owner_query

    if include_none:
        query |= Q(
            unassigned_filter(True, projects, field_filter),
            ~Q(
                **{
                    f"{field_filter}__in": GroupOwner.objects.filter(
                        project_id__in=[p.id for p in projects],
                    ).values_list("group_id", flat=True)
                }
            ),
        )

    return query


def regressed_in_release_filter(versions: Sequence[str], projects: Sequence[Project]) -> Q:
    release_ids = Release.objects.filter(
        organization_id=projects[0].organization_id, version__in=versions
    ).values_list("id", flat=True)
    return Q(
        id__in=GroupHistory.objects.filter(
            release_id__in=release_ids,
            status=GroupHistoryStatus.REGRESSED,
            project__in=projects,
        ).values_list("group_id", flat=True),
    )


_side_query_pool = ThreadPoolExecutor(max_workers=10)

atexit.register(_side_query_pool.shutdown, False)


def _group_attributes_side_query(
    events_only_search_results: CursorResult[Group],
    builder: Callable[[], BaseQuerySet[Group, Group]],
    projects: Sequence[Project],
    retention_window_start: datetime | None,
    group_queryset: BaseQuerySet[Group, Group],
    environments: Sequence[Environment] | None = None,
    sort_by: str = "date",
    limit: int = 100,
    cursor: Cursor | None = None,
    count_hits: bool = False,
    paginator_options: Mapping[str, Any] | None = None,
    search_filters: Sequence[SearchFilter] | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    max_hits: int | None = None,
    referrer: str | None = None,
    actor: Any | None = None,
    aggregate_kwargs: TrendsSortWeights | None = None,
) -> None:
    def __run_joined_query_and_log_metric(
        events_only_search_results: CursorResult[Group],
        builder: Callable[[], BaseQuerySet[Group, Group]],
        projects: Sequence[Project],
        retention_window_start: datetime | None,
        group_queryset: BaseQuerySet[Group, Group],
        environments: Sequence[Environment] | None = None,
        sort_by: str = "date",
        limit: int = 100,
        cursor: Cursor | None = None,
        count_hits: bool = False,
        paginator_options: Mapping[str, Any] | None = None,
        search_filters: Sequence[SearchFilter] | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        max_hits: int | None = None,
        referrer: str | None = None,
        actor: Any | None = None,
        aggregate_kwargs: TrendsSortWeights | None = None,
    ) -> None:
        from sentry.utils import metrics

        try:
            from sentry.search.snuba.executors import GroupAttributesPostgresSnubaQueryExecutor

            executor = GroupAttributesPostgresSnubaQueryExecutor()
            with metrics.timer("snuba.search.group_attributes_joined.duration"):
                cursor_results = executor.query(
                    projects,
                    retention_window_start,
                    builder(),
                    environments,
                    sort_by,
                    limit,
                    cursor,
                    count_hits,
                    paginator_options,
                    search_filters,
                    date_from,
                    date_to,
                    max_hits,
                    referrer,
                    actor,
                    aggregate_kwargs,
                )
            joined_hits = len(cursor_results.results)
            events_only_search_hits = len(events_only_search_results.results)
            if events_only_search_hits > 0:
                if joined_hits == events_only_search_hits:
                    comparison = "equal"
                elif joined_hits > events_only_search_hits:
                    comparison = "greater"
                else:
                    # the joined query shouldn't have fewer hits since the query is deliberately less restrictive
                    comparison = "less"

                metrics.incr(
                    "snuba.search.group_attributes_joined.events_compared",
                    tags={"comparison": comparison},
                )

            metrics.incr("snuba.search.group_attributes_joined.query", tags={"exception": "none"})
        except InvalidQueryForExecutor as e:
            logger.info(
                "unsupported query received in GroupAttributesPostgresSnubaQueryExecutor",
                exc_info=True,
            )
            metrics.incr(
                "snuba.search.group_attributes_joined.query",
                tags={
                    "exception": f"{type(e).__module__}.{type(e).__qualname__}",
                },
            )
        except Exception as e:
            logger.warning(
                "failed to load side query from _group_attributes_side_query", exc_info=True
            )
            metrics.incr(
                "snuba.search.group_attributes_joined.query",
                tags={
                    "exception": f"{type(e).__module__}.{type(e).__qualname__}",
                },
            )
        finally:
            # since this code is running in a thread and django establishes a connection per thread, we need to
            # explicitly close the connection assigned to this thread to avoid linger connections
            from django.db import connection

            connection.close()

    try:
        _side_query_pool.submit(
            __run_joined_query_and_log_metric,
            events_only_search_results,
            builder,
            projects,
            retention_window_start,
            group_queryset,
            environments,
            sort_by,
            limit,
            cursor,
            count_hits,
            paginator_options,
            search_filters,
            date_from,
            date_to,
            max_hits,
            referrer,
            actor,
            aggregate_kwargs,
        )
    except Exception:
        logger.exception("failed to submit group-attributes search side-query to pool")


class Condition:
    """\
    Adds a single filter to a ``QuerySet`` object. Used with
    ``QuerySetBuilder``.
    """

    def apply(
        self, queryset: BaseQuerySet[Group, Group], search_filter: SearchFilter
    ) -> BaseQuerySet[Group, Group]:
        raise NotImplementedError


class QCallbackCondition(Condition):
    def __init__(self, callback: Callable[[Any], Q]):
        self.callback = callback

    def apply(
        self, queryset: BaseQuerySet[Group, Group], search_filter: SearchFilter
    ) -> BaseQuerySet[Group, Group]:
        value = search_filter.value.raw_value
        q = self.callback(value)
        if search_filter.operator not in ("=", "!=", "IN", "NOT IN"):
            raise InvalidSearchQuery(
                f"Operator {search_filter.operator} not valid for search {search_filter}"
            )
        queryset_method = (
            queryset.filter if search_filter.operator in EQUALITY_OPERATORS else queryset.exclude
        )
        queryset = queryset_method(q)
        return queryset


class ScalarCondition(Condition):
    """
    Adds a scalar filter to a ``QuerySet`` object. Only accepts `SearchFilter`
    instances
    """

    def __init__(self, field: str, extra: dict[str, Sequence[int]] | None = None):
        self.field = field
        self.extra = extra

    def _get_operator(self, search_filter: SearchFilter) -> str:
        django_operator = OPERATOR_TO_DJANGO.get(search_filter.operator, "")
        if django_operator:
            django_operator = f"__{django_operator}"
        return django_operator

    def apply(
        self, queryset: BaseQuerySet[Group, Group], search_filter: SearchFilter
    ) -> BaseQuerySet[Group, Group]:
        django_operator = self._get_operator(search_filter)
        qs_method = queryset.exclude if search_filter.operator == "!=" else queryset.filter

        q_dict = {f"{self.field}{django_operator}": search_filter.value.raw_value}
        if self.extra:
            q_dict.update(self.extra)

        return qs_method(**q_dict)


class QuerySetBuilder:
    def __init__(self, conditions: Mapping[str, Condition]):
        self.conditions = conditions

    def build(
        self, queryset: BaseQuerySet[Group, Group], search_filters: Sequence[SearchFilter]
    ) -> BaseQuerySet[Group, Group]:
        for search_filter in search_filters:
            name = search_filter.key.name
            if name in self.conditions:
                condition = self.conditions[name]
                queryset = condition.apply(queryset, search_filter)
        return queryset


class SnubaSearchBackendBase(SearchBackend, metaclass=ABCMeta):
    def query(
        self,
        projects: Sequence[Project],
        environments: Sequence[Environment] | None = None,
        sort_by: str = "date",
        limit: int = 100,
        cursor: Cursor | None = None,
        count_hits: bool = False,
        paginator_options: Mapping[str, Any] | None = None,
        search_filters: Sequence[SearchFilter] | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        max_hits: int | None = None,
        referrer: str | None = None,
        actor: Any | None = None,
        aggregate_kwargs: TrendsSortWeights | None = None,
        use_group_snuba_dataset: bool = False,
    ) -> CursorResult[Group]:
        search_filters = search_filters if search_filters is not None else []
        # ensure projects are from same org
        if len({p.organization_id for p in projects}) != 1:
            raise RuntimeError("Cross organization search not supported")

        if paginator_options is None:
            paginator_options = {}

        # filter out groups which are beyond the retention period
        retention = quotas.backend.get_event_retention(organization=projects[0].organization)
        if retention:
            retention_window_start = timezone.now() - timedelta(days=retention)
        else:
            retention_window_start = None

        if use_group_snuba_dataset:
            # we need to handle two cases fo the group queryset:
            # 1. Limit results to groups that are not pending deletion or merge
            # 2. Handle queries snuba doesn't support such as bookmarked_by, linked, subscribed_by, etc
            # For the second case, we hit postgres before Snuba to get the group ids
            group_queryset = self._build_limited_group_queryset(projects, search_filters)

        else:
            group_queryset = self._build_group_queryset(
                projects=projects,
                environments=environments,
                search_filters=search_filters,
                retention_window_start=retention_window_start,
                date_from=date_from,
                date_to=date_to,
            )

        query_executor = self._get_query_executor(
            group_queryset=group_queryset,
            projects=projects,
            environments=environments,
            search_filters=search_filters,
            date_from=date_from,
            date_to=date_to,
            use_group_snuba_dataset=use_group_snuba_dataset,
        )

        # ensure sort strategy is supported by executor
        if not query_executor.has_sort_strategy(sort_by):
            raise InvalidSearchQuery(f"Sort key '{sort_by}' not supported.")

        with metrics.timer("snuba.search.postgres_snuba.duration"):
            query_results = query_executor.query(
                projects=projects,
                retention_window_start=retention_window_start,
                group_queryset=group_queryset,
                environments=environments,
                sort_by=sort_by,
                limit=limit,
                cursor=cursor,
                count_hits=count_hits,
                paginator_options=paginator_options,
                search_filters=search_filters,
                date_from=date_from,
                date_to=date_to,
                max_hits=max_hits,
                referrer=referrer,
                actor=actor,
                aggregate_kwargs=aggregate_kwargs,
            )

        if len(projects) > 0 and features.has(
            "organizations:issue-search-group-attributes-side-query", projects[0].organization
        ):
            new_group_queryset = self._build_group_queryset(
                projects=projects,
                environments=environments,
                search_filters=search_filters,
                retention_window_start=retention_window_start,
                date_from=date_from,
                date_to=date_to,
            )

            builder = functools.partial(
                self._build_group_queryset,
                projects=projects,
                environments=environments,
                search_filters=search_filters,
                retention_window_start=retention_window_start,
                date_from=date_from,
                date_to=date_to,
            )

            _group_attributes_side_query(
                events_only_search_results=query_results,
                builder=builder,
                projects=projects,
                retention_window_start=retention_window_start,
                group_queryset=new_group_queryset,
                environments=environments,
                sort_by=sort_by,
                limit=limit,
                cursor=cursor,
                count_hits=count_hits,
                paginator_options=paginator_options,
                search_filters=search_filters,
                date_from=date_from,
                date_to=date_to,
                max_hits=max_hits,
                referrer=referrer,
                actor=actor,
                aggregate_kwargs=aggregate_kwargs,
            )

        return query_results

    def _build_limited_group_queryset(
        self, projects: Sequence[Project], search_filters: Sequence[SearchFilter]
    ) -> BaseQuerySet[Group, Group]:
        """
        Builds a group queryset to handle joins for data that doesn't exist in Clickhouse on the group_attributes dataset
        """
        # Filter search_filters to only include 'bookmarked_by', 'linked', 'subscribed_by'
        filtered_search_filters = [
            sf for sf in search_filters if sf.key.name in POSTGRES_ONLY_SEARCH_FIELDS
        ]
        # Use the filtered search filters for further processing
        return self._build_group_queryset(
            projects=projects,
            environments=None,
            search_filters=filtered_search_filters,
            retention_window_start=None,
        )

    def _build_group_queryset(
        self,
        projects: Sequence[Project],
        environments: Sequence[Environment] | None,
        search_filters: Sequence[SearchFilter],
        retention_window_start: datetime | None,
        *args: Any,
        **kwargs: Any,
    ) -> BaseQuerySet[Group, Group]:
        """This method should return a QuerySet of the Group model.
        How you implement it is up to you, but we generally take in the various search parameters
        and filter Group's down using the field's we want to query on in Postgres."""

        group_queryset = self._initialize_group_queryset(
            projects, environments, retention_window_start, search_filters
        )
        qs_builder_conditions = self._get_queryset_conditions(
            projects, environments, search_filters
        )
        group_queryset = QuerySetBuilder(qs_builder_conditions).build(
            group_queryset, search_filters
        )
        return group_queryset

    def _initialize_group_queryset(
        self,
        projects: Sequence[Project],
        environments: Sequence[Environment] | None,
        retention_window_start: datetime | None,
        search_filters: Sequence[SearchFilter],
    ) -> BaseQuerySet[Group, Group]:
        group_queryset = Group.objects.filter(project__in=projects).exclude(
            status__in=[
                GroupStatus.PENDING_DELETION,
                GroupStatus.DELETION_IN_PROGRESS,
                GroupStatus.PENDING_MERGE,
            ]
        )

        if retention_window_start:
            group_queryset = group_queryset.filter(last_seen__gte=retention_window_start)

        if environments is not None:
            environment_ids = [environment.id for environment in environments]
            group_queryset = group_queryset.filter(
                id__in=GroupEnvironment.objects.filter(environment__in=environment_ids).values_list(
                    "group_id"
                )
            )
        return group_queryset

    @abstractmethod
    def _get_queryset_conditions(
        self,
        projects: Sequence[Project],
        environments: Sequence[Environment] | None,
        search_filters: Sequence[SearchFilter],
    ) -> Mapping[str, Condition]:
        """This method should return a dict of query set fields and a "Condition" to apply on that field."""
        raise NotImplementedError

    @abstractmethod
    def _get_query_executor(
        self,
        group_queryset: BaseQuerySet[Group, Group],
        projects: Sequence[Project],
        environments: Sequence[Environment] | None,
        search_filters: Sequence[SearchFilter],
        date_from: datetime | None,
        date_to: datetime | None,
        use_group_snuba_dataset: bool,
    ) -> AbstractQueryExecutor:
        """This method should return an implementation of the AbstractQueryExecutor
        We will end up calling .query() on the class returned by this method"""
        raise NotImplementedError


class EventsDatasetSnubaSearchBackend(SnubaSearchBackendBase):
    def _get_query_executor(self, *args: Any, **kwargs: Any) -> AbstractQueryExecutor:
        if kwargs.get("use_group_snuba_dataset"):
            from sentry.search.snuba.executors import GroupAttributesPostgresSnubaQueryExecutor

            return GroupAttributesPostgresSnubaQueryExecutor()
        return PostgresSnubaQueryExecutor()

    def _get_queryset_conditions(
        self,
        projects: Sequence[Project],
        environments: Sequence[Environment] | None,
        search_filters: Sequence[SearchFilter],
    ) -> Mapping[str, Condition]:
        queryset_conditions: dict[str, Condition] = {
            "status": QCallbackCondition(lambda statuses: Q(status__in=statuses)),
            "substatus": QCallbackCondition(lambda substatuses: Q(substatus__in=substatuses)),
            "bookmarked_by": QCallbackCondition(
                lambda users: Q(
                    bookmark_set__project__in=projects,
                    bookmark_set__user_id__in=[u.id for u in users if u],
                )
            ),
            "assigned_to": QCallbackCondition(
                functools.partial(assigned_to_filter, projects=projects)
            ),
            "unassigned": QCallbackCondition(
                functools.partial(unassigned_filter, projects=projects)
            ),
            "linked": QCallbackCondition(functools.partial(linked_filter, projects=projects)),
            "subscribed_by": QCallbackCondition(
                lambda users: Q(
                    id__in=GroupSubscription.objects.filter(
                        project__in=projects, user_id__in=[u.id for u in users if u], is_active=True
                    ).values_list("group")
                )
            ),
            "for_review": QCallbackCondition(functools.partial(inbox_filter, projects=projects)),
            "assigned_or_suggested": QCallbackCondition(
                functools.partial(assigned_or_suggested_filter, projects=projects)
            ),
            "regressed_in_release": QCallbackCondition(
                functools.partial(regressed_in_release_filter, projects=projects)
            ),
            "issue.category": QCallbackCondition(lambda categories: Q(type__in=categories)),
            "issue.type": QCallbackCondition(lambda types: Q(type__in=types)),
            "issue.priority": QCallbackCondition(lambda priorities: Q(priority__in=priorities)),
        }

        message_filter = next((sf for sf in search_filters or () if "message" == sf.key.name), None)
        if message_filter:

            def _issue_platform_issue_message_condition(query: str) -> Q:
                return Q(
                    ~Q(type=ErrorGroupType.type_id),
                    message__icontains=query,
                )

            queryset_conditions.update(
                {
                    "message": (
                        QCallbackCondition(
                            lambda query: Q(type=ErrorGroupType.type_id)
                            | _issue_platform_issue_message_condition(query)
                        )
                        # negation should only apply on the message search icontains, we have to include
                        # the type filter(type=GroupType.ERROR) check since we don't wanna search on the message
                        # column when type=GroupType.ERROR - we delegate that to snuba in that case
                        if not message_filter.is_negation
                        else QCallbackCondition(
                            lambda query: _issue_platform_issue_message_condition(query)
                        )
                    )
                }
            )

        if environments is not None:
            environment_ids = [environment.id for environment in environments]
            queryset_conditions.update(
                {
                    "first_release": QCallbackCondition(
                        lambda versions: Q(
                            # if environment(s) are selected, we just filter on the group
                            # environment's first_release attribute.
                            id__in=GroupEnvironment.objects.filter(
                                first_release__organization_id=projects[0].organization_id,
                                first_release__version__in=versions,
                                environment_id__in=environment_ids,
                            ).values_list("group_id"),
                        )
                    ),
                    "first_seen": ScalarCondition(
                        "groupenvironment__first_seen",
                        {"groupenvironment__environment_id__in": environment_ids},
                    ),
                }
            )
        else:
            queryset_conditions.update(
                {
                    "first_release": QCallbackCondition(
                        functools.partial(
                            first_release_all_environments_filter,
                            projects=projects,
                        )
                    ),
                    "first_seen": ScalarCondition("first_seen"),
                }
            )
        return queryset_conditions
