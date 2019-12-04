from __future__ import absolute_import

import functools
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from sentry import quotas
from sentry.api.event_search import InvalidSearchQuery
from sentry.api.paginator import Paginator
from sentry.models import Group, Release, GroupEnvironment
from sentry.search.base import SearchBackend
from sentry.search.snuba.executors import PostgresSnubaQueryExecutor

datetime_format = "%Y-%m-%dT%H:%M:%S+00:00"

EMPTY_RESULT = Paginator(Group.objects.none()).get_result()

# mapping from query parameter sort name to underlying scoring aggregation name
sort_strategies = {
    "date": "last_seen",
    "freq": "times_seen",
    "new": "first_seen",
    "priority": "priority",
}

dependency_aggregations = {"priority": ["last_seen", "times_seen"]}

aggregation_defs = {
    "times_seen": ["count()", ""],
    "first_seen": ["multiply(toUInt64(min(timestamp)), 1000)", ""],
    "last_seen": ["multiply(toUInt64(max(timestamp)), 1000)", ""],
    # https://github.com/getsentry/sentry/blob/804c85100d0003cfdda91701911f21ed5f66f67c/src/sentry/event_manager.py#L241-L271
    "priority": ["toUInt64(plus(multiply(log(times_seen), 600), last_seen))", ""],
    # Only makes sense with WITH TOTALS, returns 1 for an individual group.
    "total": ["uniq", "group_id"],
}
issue_only_fields = set(
    [
        "query",
        "status",
        "bookmarked_by",
        "assigned_to",
        "unassigned",
        "subscribed_by",
        "active_at",
        "first_release",
        "first_seen",
    ]
)


def assigned_to_filter(actor, projects):
    from sentry.models import OrganizationMember, OrganizationMemberTeam, Team

    if isinstance(actor, Team):
        return Q(assignee_set__team=actor)

    teams = Team.objects.filter(
        id__in=OrganizationMemberTeam.objects.filter(
            organizationmember__in=OrganizationMember.objects.filter(
                user=actor, organization_id=projects[0].organization_id
            ),
            is_active=True,
        ).values("team")
    )

    return Q(
        Q(assignee_set__user=actor, assignee_set__project__in=projects)
        | Q(assignee_set__team__in=teams)
    )


def unassigned_filter(unassigned, projects):
    from sentry.models.groupassignee import GroupAssignee

    query = Q(
        id__in=GroupAssignee.objects.filter(project_id__in=[p.id for p in projects]).values_list(
            "group_id", flat=True
        )
    )
    if unassigned:
        query = ~query
    return query


class Condition(object):
    """\
    Adds a single filter to a ``QuerySet`` object. Used with
    ``QuerySetBuilder``.
    """

    def apply(self, queryset, name, parameters):
        raise NotImplementedError


class QCallbackCondition(Condition):
    def __init__(self, callback):
        self.callback = callback

    def apply(self, queryset, search_filter):
        value = search_filter.value.raw_value
        q = self.callback(value)
        if search_filter.operator not in ("=", "!="):
            raise InvalidSearchQuery(
                u"Operator {} not valid for search {}".format(search_filter.operator, search_filter)
            )
        queryset_method = queryset.filter if search_filter.operator == "=" else queryset.exclude
        queryset = queryset_method(q)
        return queryset


class ScalarCondition(Condition):
    """
    Adds a scalar filter to a ``QuerySet`` object. Only accepts `SearchFilter`
    instances
    """

    OPERATOR_TO_DJANGO = {">=": "gte", "<=": "lte", ">": "gt", "<": "lt"}

    def __init__(self, field, extra=None):
        self.field = field
        self.extra = extra

    def _get_operator(self, search_filter):
        django_operator = self.OPERATOR_TO_DJANGO.get(search_filter.operator, "")
        if django_operator:
            django_operator = "__{}".format(django_operator)
        return django_operator

    def apply(self, queryset, search_filter):
        django_operator = self._get_operator(search_filter)
        qs_method = queryset.exclude if search_filter.operator == "!=" else queryset.filter

        q_dict = {"{}{}".format(self.field, django_operator): search_filter.value.raw_value}
        if self.extra:
            q_dict.update(self.extra)

        return qs_method(**q_dict)


class QuerySetBuilder(object):
    def __init__(self, conditions):
        self.conditions = conditions

    def build(self, queryset, search_filters):
        for search_filter in search_filters:
            name = search_filter.key.name
            if name in self.conditions:
                condition = self.conditions[name]
                queryset = condition.apply(queryset, search_filter)
        return queryset


class SnubaSearchBackend(SearchBackend):
    def query(
        self,
        projects,
        environments=None,
        sort_by="date",
        limit=100,
        cursor=None,
        count_hits=False,
        paginator_options=None,
        search_filters=None,
        date_from=None,
        date_to=None,
    ):
        from sentry.models import Group, GroupStatus, GroupSubscription

        search_filters = search_filters if search_filters is not None else []

        # ensure projects are from same org
        if len({p.organization_id for p in projects}) != 1:
            raise RuntimeError("Cross organization search not supported")

        if paginator_options is None:
            paginator_options = {}

        group_queryset = Group.objects.filter(project__in=projects).exclude(
            status__in=[
                GroupStatus.PENDING_DELETION,
                GroupStatus.DELETION_IN_PROGRESS,
                GroupStatus.PENDING_MERGE,
            ]
        )

        qs_builder_conditions = {
            "status": QCallbackCondition(lambda status: Q(status=status)),
            "bookmarked_by": QCallbackCondition(
                lambda user: Q(bookmark_set__project__in=projects, bookmark_set__user=user)
            ),
            "assigned_to": QCallbackCondition(
                functools.partial(assigned_to_filter, projects=projects)
            ),
            "unassigned": QCallbackCondition(
                functools.partial(unassigned_filter, projects=projects)
            ),
            "subscribed_by": QCallbackCondition(
                lambda user: Q(
                    id__in=GroupSubscription.objects.filter(
                        project__in=projects, user=user, is_active=True
                    ).values_list("group")
                )
            ),
            "active_at": ScalarCondition("active_at"),
        }

        group_queryset = QuerySetBuilder(qs_builder_conditions).build(
            group_queryset, search_filters
        )
        # filter out groups which are beyond the retention period
        retention = quotas.get_event_retention(organization=projects[0].organization)
        if retention:
            retention_window_start = timezone.now() - timedelta(days=retention)
        else:
            retention_window_start = None
        # TODO: This could be optimized when building querysets to identify
        # criteria that are logically impossible (e.g. if the upper bound
        # for last seen is before the retention window starts, no results
        # exist.)
        if retention_window_start:
            group_queryset = group_queryset.filter(last_seen__gte=retention_window_start)

        # TODO: It's possible `first_release` could be handled by Snuba.
        if environments is not None:
            environment_ids = [environment.id for environment in environments]
            group_queryset = group_queryset.filter(
                groupenvironment__environment_id__in=environment_ids
            )
            group_queryset = QuerySetBuilder(
                {
                    "first_release": QCallbackCondition(
                        lambda version: Q(
                            # if environment(s) are selected, we just filter on the group
                            # environment's first_release attribute.
                            groupenvironment__first_release__organization_id=projects[
                                0
                            ].organization_id,
                            groupenvironment__first_release__version=version,
                            groupenvironment__environment_id__in=environment_ids,
                        )
                    ),
                    "first_seen": ScalarCondition(
                        "groupenvironment__first_seen",
                        {"groupenvironment__environment_id__in": environment_ids},
                    ),
                }
            ).build(group_queryset, search_filters)
        else:
            group_queryset = QuerySetBuilder(
                {
                    "first_release": QCallbackCondition(
                        lambda release_version: Q(
                            # if no specific environments are supplied, we either choose any
                            # groups/issues whose first release matches the given release_version,
                            Q(
                                first_release_id__in=Release.objects.filter(
                                    version=release_version,
                                    organization_id=projects[0].organization_id,
                                )
                            )
                            |
                            # or we choose any groups whose first occurrence in any environment and the latest release at
                            # the time of the groups' first occurrence matches the given
                            # release_version
                            Q(
                                id__in=GroupEnvironment.objects.filter(
                                    first_release__version=release_version,
                                    first_release__organization_id=projects[0].organization_id,
                                    environment__organization_id=projects[0].organization_id,
                                ).values_list("group_id")
                            )
                        )
                    ),
                    "first_seen": ScalarCondition("first_seen"),
                }
            ).build(group_queryset, search_filters)

        query_executor = PostgresSnubaQueryExecutor()

        return query_executor.query(
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
        )


# This class will have logic to use the groups dataset, and to also determine which QueryBackend to use.
class SnubaGroupsSearchBackend(SearchBackend):
    pass
