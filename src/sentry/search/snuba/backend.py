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
    GroupLink,
    GroupOwner,
    GroupStatus,
    GroupSubscription,
    OrganizationMember,
    OrganizationMemberTeam,
    PlatformExternalIssue,
    Team,
    User,
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


def linked_filter(linked, projects):
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
    organization_id = projects[0].organization_id
    query = Q(
        id__in=GroupInbox.objects.filter(
            organization_id=organization_id, project_id__in=[p.id for p in projects]
        ).values_list("group_id", flat=True)
    )
    if not inbox:
        query = ~query
    return query


def owner_filter(owner, projects):
    organization_id = projects[0].organization_id
    project_ids = [p.id for p in projects]
    if isinstance(owner, Team):
        return Q(
            id__in=GroupOwner.objects.filter(
                team=owner, project_id__in=project_ids, organization_id=organization_id
            )
            .values_list("group_id", flat=True)
            .distinct()
        )
    elif isinstance(owner, User):
        teams = Team.objects.filter(
            id__in=OrganizationMemberTeam.objects.filter(
                organizationmember__in=OrganizationMember.objects.filter(
                    user=owner, organization_id=organization_id
                ),
                is_active=True,
            ).values("team")
        )
        relevant_owners = GroupOwner.objects.filter(
            project_id__in=project_ids, organization_id=organization_id
        )
        filter_query = Q(team__in=teams) | Q(user=owner)
        return Q(
            id__in=relevant_owners.filter(filter_query)
            .values_list("group_id", flat=True)
            .distinct()
        )
    elif isinstance(owner, list) and owner[0] == "me_or_none":
        teams = Team.objects.filter(
            id__in=OrganizationMemberTeam.objects.filter(
                organizationmember__in=OrganizationMember.objects.filter(
                    user=owner[1], organization_id=organization_id
                ),
                is_active=True,
            ).values("team")
        )

        owned_team = Q(groupowner__team__in=teams)
        owned_me = Q(groupowner__user=owner[1])
        no_owner = Q(groupowner__isnull=True)
        return no_owner | Q(
            owned_me | owned_team,
            groupowner__project_id__in=project_ids,
            groupowner__organization_id=organization_id,
        )

    raise InvalidSearchQuery(u"Unsupported owner type.")


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
            "linked": QCallbackCondition(functools.partial(linked_filter, projects=projects)),
            "subscribed_by": QCallbackCondition(
                lambda user: Q(
                    id__in=GroupSubscription.objects.filter(
                        project__in=projects, user=user, is_active=True
                    ).values_list("group")
                )
            ),
            "active_at": ScalarCondition("active_at"),
            "needs_review": QCallbackCondition(functools.partial(inbox_filter, projects=projects)),
            "owner": QCallbackCondition(functools.partial(owner_filter, projects=projects)),
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
