from __future__ import absolute_import

from abc import ABCMeta, abstractmethod
import functools
import six
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone

from sentry import quotas
from sentry.api.event_search import InvalidSearchQuery
from sentry.models import (
    Release,
    GroupEnvironment,
    Group,
    GroupInbox,
    GroupStatus,
    GroupSubscription,
)
from sentry.search.base import SearchBackend
from sentry.search.snuba.executors import PostgresSnubaQueryExecutor


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


def first_release_all_environments_filter(version, projects):
    try:
        release_id = Release.objects.get(
            organization=projects[0].organization_id, version=version
        ).id
    except Release.DoesNotExist:
        release_id = -1
    return Q(
        # If no specific environments are supplied, we look at the
        # first_release of any environment that the group has been
        # seen in.
        id__in=GroupEnvironment.objects.filter(first_release_id=release_id).values_list("group_id")
    )


def inbox_filter(inbox, projects):
    query = Q(
        id__in=GroupInbox.objects.filter(project_id__in=[p.id for p in projects]).values_list(
            "group_id", flat=True
        )
    )
    if not inbox:
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


@six.add_metaclass(ABCMeta)
class SnubaSearchBackendBase(SearchBackend):
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
        search_filters = search_filters if search_filters is not None else []

        # ensure projects are from same org
        if len({p.organization_id for p in projects}) != 1:
            raise RuntimeError("Cross organization search not supported")

        if paginator_options is None:
            paginator_options = {}

        # filter out groups which are beyond the retention period
        retention = quotas.get_event_retention(organization=projects[0].organization)
        if retention:
            retention_window_start = timezone.now() - timedelta(days=retention)
        else:
            retention_window_start = None

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
        )

        # ensure sort strategy is supported by executor
        if not query_executor.has_sort_strategy(sort_by):
            raise InvalidSearchQuery(u"Sort key '{}' not supported.".format(sort_by))

        return query_executor.query(
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
        )

    def _build_group_queryset(
        self, projects, environments, search_filters, retention_window_start, *args, **kwargs
    ):
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
        self, projects, environments, retention_window_start, search_filters
    ):
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
                groupenvironment__environment_id__in=environment_ids
            )
        return group_queryset

    @abstractmethod
    def _get_queryset_conditions(self, projects, environments, search_filters):
        """This method should return a dict of query set fields and a "Condition" to apply on that field."""
        raise NotImplementedError

    @abstractmethod
    def _get_query_executor(
        self, group_queryset, projects, environments, search_filters, date_from, date_to
    ):
        """This method should return an implementation of the AbstractQueryExecutor
        We will end up calling .query() on the class returned by this method"""
        raise NotImplementedError


class EventsDatasetSnubaSearchBackend(SnubaSearchBackendBase):
    def _get_query_executor(self, *args, **kwargs):
        return PostgresSnubaQueryExecutor()

    def _get_queryset_conditions(self, projects, environments, search_filters):
        queryset_conditions = {
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
            "inbox": QCallbackCondition(functools.partial(inbox_filter, projects=projects)),
        }

        if environments is not None:
            environment_ids = [environment.id for environment in environments]
            queryset_conditions.update(
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
            )
        else:
            queryset_conditions.update(
                {
                    "first_release": QCallbackCondition(
                        functools.partial(first_release_all_environments_filter, projects=projects)
                    ),
                    "first_seen": ScalarCondition("first_seen"),
                }
            )
        return queryset_conditions
