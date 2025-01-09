from __future__ import annotations

import logging
import re
import warnings
from collections import defaultdict, namedtuple
from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime, timedelta
from enum import Enum
from functools import reduce
from operator import or_
from typing import TYPE_CHECKING, Any, ClassVar

from django.core.cache import cache
from django.db import models
from django.db.models import Q, QuerySet
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.utils import timezone
from django.utils.http import urlencode
from django.utils.translation import gettext_lazy as _
from snuba_sdk import Column, Condition, Op

from sentry import eventstore, eventtypes, options, tagstore
from sentry.backup.scopes import RelocationScope
from sentry.constants import DEFAULT_LOGGER_NAME, LOG_LEVELS, MAX_CULPRIT_LENGTH
from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.manager.base import BaseManager
from sentry.eventstore.models import GroupEvent
from sentry.issues.grouptype import GroupCategory, get_group_type_by_type_id
from sentry.issues.priority import (
    PRIORITY_TO_GROUP_HISTORY_STATUS,
    PriorityChangeReason,
    get_priority_for_ongoing_group,
)
from sentry.models.commit import Commit
from sentry.models.grouphistory import record_group_history, record_group_history_from_activity_type
from sentry.models.organization import Organization
from sentry.snuba.dataset import Dataset
from sentry.snuba.referrer import Referrer
from sentry.types.activity import ActivityType
from sentry.types.actor import Actor
from sentry.types.group import (
    IGNORED_SUBSTATUS_CHOICES,
    UNRESOLVED_SUBSTATUS_CHOICES,
    GroupSubStatus,
)
from sentry.utils import metrics
from sentry.utils.dates import outside_retention_with_modified_start
from sentry.utils.numbers import base32_decode, base32_encode
from sentry.utils.strings import strip, truncatechars

if TYPE_CHECKING:
    from sentry.integrations.services.integration import RpcIntegration
    from sentry.models.environment import Environment
    from sentry.models.team import Team
    from sentry.users.services.user import RpcUser

logger = logging.getLogger(__name__)

_short_id_re = re.compile(r"^(?:issue+:)?(.*?)(?:[\s_-])([A-Za-z0-9]+)$")
ShortId = namedtuple("ShortId", ["project_slug", "short_id"])

DEFAULT_TYPE_ID = 1


def parse_short_id(short_id_s: str) -> ShortId | None:
    match = _short_id_re.match(short_id_s.strip())
    if match is None:
        return None
    slug, id = match.groups()
    slug = slug.lower()
    try:
        short_id = base32_decode(id)
        # We need to make sure the short id is not overflowing the
        # field's max or the lookup will fail with an assertion error.
        max_id = Group._meta.get_field("short_id").MAX_VALUE
        if short_id > max_id:
            return None
    except ValueError:
        return None
    return ShortId(slug, short_id)


def looks_like_short_id(value):
    return _short_id_re.match((value or "").strip()) is not None


def get_group_with_redirect(id_or_qualified_short_id, queryset=None, organization=None):
    """
    Retrieve a group by ID, checking the redirect table if the requested group
    does not exist. Returns a two-tuple of ``(object, redirected)``.
    """
    if queryset is None:
        if organization:
            queryset = Group.objects.filter(project__organization=organization)
            getter = queryset.get
        else:
            queryset = Group.objects.all()
            # When not passing a queryset, we want to read from cache
            getter = Group.objects.get_from_cache
    else:
        if organization:
            queryset = queryset.filter(project__organization=organization)
        getter = queryset.get

    if not (isinstance(id_or_qualified_short_id, int) or id_or_qualified_short_id.isdigit()):
        short_id = parse_short_id(id_or_qualified_short_id)
        if not short_id or not organization:
            raise Group.DoesNotExist()
        params = {
            "project__slug": short_id.project_slug,
            "short_id": short_id.short_id,
            "project__organization": organization,
        }
    else:
        short_id = None
        params = {"id": id_or_qualified_short_id}

    try:
        return getter(**params), False
    except Group.DoesNotExist as error:
        from sentry.models.groupredirect import GroupRedirect

        if short_id:
            params = {
                "id__in": GroupRedirect.objects.filter(
                    organization_id=organization.id,
                    previous_short_id=short_id.short_id,
                    previous_project_slug=short_id.project_slug,
                ).values_list("group_id", flat=True)[:1]
            }
        else:
            params = {
                "id__in": GroupRedirect.objects.filter(
                    previous_group_id=id_or_qualified_short_id,
                ).values_list("group_id", flat=True)[:1]
            }

        try:
            return queryset.get(**params), True
        except Group.DoesNotExist:
            raise error  # raise original `DoesNotExist`


# TODO(dcramer): pull in enum library
class GroupStatus:
    UNRESOLVED = 0
    RESOLVED = 1
    IGNORED = 2
    PENDING_DELETION = 3
    DELETION_IN_PROGRESS = 4
    PENDING_MERGE = 5

    # The group's events are being re-processed and after that the group will
    # be deleted. In this state no new events shall be added to the group.
    REPROCESSING = 6

    # TODO(dcramer): remove in 9.0
    MUTED = IGNORED


STATUS_WITHOUT_SUBSTATUS = {
    GroupStatus.RESOLVED,
    GroupStatus.PENDING_DELETION,
    GroupStatus.DELETION_IN_PROGRESS,
    GroupStatus.PENDING_MERGE,
    GroupStatus.REPROCESSING,
}

# Statuses that can be queried/searched for
STATUS_QUERY_CHOICES: Mapping[str, int] = {
    "resolved": GroupStatus.RESOLVED,
    "unresolved": GroupStatus.UNRESOLVED,
    "ignored": GroupStatus.IGNORED,
    "archived": GroupStatus.IGNORED,
    # TODO(dcramer): remove in 9.0
    "muted": GroupStatus.IGNORED,
    "reprocessing": GroupStatus.REPROCESSING,
}
QUERY_STATUS_LOOKUP = {
    status: query for query, status in STATUS_QUERY_CHOICES.items() if query != "muted"
}

GROUP_SUBSTATUS_TO_STATUS_MAP = {
    GroupSubStatus.ESCALATING: GroupStatus.UNRESOLVED,
    GroupSubStatus.REGRESSED: GroupStatus.UNRESOLVED,
    GroupSubStatus.ONGOING: GroupStatus.UNRESOLVED,
    GroupSubStatus.NEW: GroupStatus.UNRESOLVED,
    GroupSubStatus.UNTIL_ESCALATING: GroupStatus.IGNORED,
    GroupSubStatus.FOREVER: GroupStatus.IGNORED,
    GroupSubStatus.UNTIL_CONDITION_MET: GroupStatus.IGNORED,
}

# Statuses that can be updated from the regular "update group" API
#
# Differences over STATUS_QUERY_CHOICES:
#
# reprocessing is missing as it is its own endpoint and requires extra input
# resolvedInNextRelease is added as that is an action that can be taken, but at
# the same time it can't be queried for
STATUS_UPDATE_CHOICES = {
    "resolved": GroupStatus.RESOLVED,
    "unresolved": GroupStatus.UNRESOLVED,
    "ignored": GroupStatus.IGNORED,
    "resolvedInNextRelease": GroupStatus.UNRESOLVED,
    # TODO(dcramer): remove in 9.0
    "muted": GroupStatus.IGNORED,
}


class EventOrdering(Enum):
    LATEST = ["-timestamp", "-event_id"]
    OLDEST = ["timestamp", "event_id"]
    RECOMMENDED = [
        "-replay.id",
        "-trace.sampled",
        "num_processing_errors",
        "-profile.id",
        "-timestamp",
        "-event_id",
    ]


def get_oldest_or_latest_event(
    group: Group,
    ordering: EventOrdering,
    conditions: Sequence[Condition] | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> GroupEvent | None:

    if group.issue_category == GroupCategory.ERROR:
        dataset = Dataset.Events
    else:
        dataset = Dataset.IssuePlatform

    all_conditions = [
        Condition(Column("project_id"), Op.IN, [group.project.id]),
        Condition(Column("group_id"), Op.IN, [group.id]),
    ]

    if conditions:
        all_conditions.extend(conditions)

    events = eventstore.backend.get_events_snql(
        organization_id=group.project.organization_id,
        group_id=group.id,
        start=start,
        end=end,
        conditions=all_conditions,
        limit=1,
        orderby=ordering.value,
        referrer="Group.get_latest",
        dataset=dataset,
        tenant_ids={"organization_id": group.project.organization_id},
    )

    if events:
        return events[0].for_group(group)

    return None


def get_recommended_event(
    group: Group,
    conditions: Sequence[Condition] | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
) -> GroupEvent | None:
    if group.issue_category == GroupCategory.ERROR:
        dataset = Dataset.Events
    else:
        dataset = Dataset.IssuePlatform

    all_conditions = [
        Condition(Column("project_id"), Op.IN, [group.project.id]),
        Condition(Column("group_id"), Op.IN, [group.id]),
    ]

    if conditions:
        all_conditions.extend(conditions)

    default_end = group.last_seen + timedelta(minutes=1)
    default_start = default_end - timedelta(days=7)

    expired, _ = outside_retention_with_modified_start(
        start=start if start else default_start,
        end=end if end else default_end,
        organization=Organization(group.project.organization_id),
    )

    if expired:
        return None

    events = eventstore.backend.get_events_snql(
        organization_id=group.project.organization_id,
        group_id=group.id,
        start=start if start else default_start,
        end=end if end else default_end,
        conditions=all_conditions,
        limit=1,
        orderby=EventOrdering.RECOMMENDED.value,
        referrer="Group.get_helpful",
        dataset=dataset,
        tenant_ids={"organization_id": group.project.organization_id},
    )

    if events:
        return events[0].for_group(group)

    return None


class GroupManager(BaseManager["Group"]):
    use_for_related_fields = True

    def get_queryset(self):
        return (
            super()
            .get_queryset()
            .with_post_update_signal(options.get("groups.enable-post-update-signal"))
        )

    def by_qualified_short_id(self, organization_id: int, short_id: str):
        return self.by_qualified_short_id_bulk(organization_id, [short_id])[0]

    def by_qualified_short_id_bulk(
        self, organization_id: int, short_ids_raw: list[str]
    ) -> Sequence[Group]:
        short_ids = []
        for short_id_raw in short_ids_raw:
            parsed_short_id = parse_short_id(short_id_raw)
            if parsed_short_id is None:
                raise Group.DoesNotExist()
            short_ids.append(parsed_short_id)
        if not short_ids:
            raise Group.DoesNotExist()

        project_short_id_lookup = defaultdict(list)
        for short_id in short_ids:
            project_short_id_lookup[short_id.project_slug].append(short_id.short_id)

        short_id_lookup = reduce(
            or_,
            [
                Q(project__slug=slug, short_id__in=short_ids)
                for slug, short_ids in project_short_id_lookup.items()
            ],
        )

        groups = list(
            self.exclude(
                status__in=[
                    GroupStatus.PENDING_DELETION,
                    GroupStatus.DELETION_IN_PROGRESS,
                    GroupStatus.PENDING_MERGE,
                ]
            ).filter(short_id_lookup, project__organization=organization_id)
        )
        group_lookup: set[int] = {group.short_id for group in groups}
        for short_id in short_ids:
            if short_id.short_id not in group_lookup:
                raise Group.DoesNotExist()
        return groups

    def from_event_id(self, project, event_id):
        """Resolves the 32 character event_id string into a Group for which it is found."""
        group_id = None

        event = eventstore.backend.get_event_by_id(project.id, event_id)

        if event:
            group_id = event.group_id

        if group_id is None:
            # Raise a Group.DoesNotExist here since it makes
            # more logical sense since this is intending to resolve
            # a Group.
            raise Group.DoesNotExist()

        return self.get(id=group_id)

    def filter_by_event_id(self, project_ids, event_id, tenant_ids=None):
        events = eventstore.backend.get_events(
            filter=eventstore.Filter(
                event_ids=[event_id],
                project_ids=project_ids,
                conditions=[["group_id", "IS NOT NULL", None]],
            ),
            limit=max(len(project_ids), 100),
            referrer="Group.filter_by_event_id",
            tenant_ids=tenant_ids,
        )
        return self.filter(id__in={event.group_id for event in events})

    def get_groups_by_external_issue(
        self,
        integration: RpcIntegration,
        organizations: Iterable[Organization],
        external_issue_key: str | None,
    ) -> QuerySet[Group]:
        from sentry.integrations.models.external_issue import ExternalIssue
        from sentry.integrations.services.integration import integration_service
        from sentry.models.grouplink import GroupLink

        external_issue_subquery = ExternalIssue.objects.get_for_integration(
            integration, external_issue_key
        ).values_list("id", flat=True)

        group_link_subquery = GroupLink.objects.filter(
            linked_id__in=external_issue_subquery
        ).values_list("group_id", flat=True)

        org_ids_with_integration = list(
            i.organization_id
            for i in integration_service.get_organization_integrations(
                organization_ids=[o.id for o in organizations], integration_id=integration.id
            )
        )

        return self.filter(
            id__in=group_link_subquery,
            project__organization_id__in=org_ids_with_integration,
        ).select_related("project")

    def update_group_status(
        self,
        groups: Iterable[Group],
        status: int,
        substatus: int | None,
        activity_type: ActivityType,
        activity_data: Mapping[str, Any] | None = None,
        send_activity_notification: bool = True,
        from_substatus: int | None = None,
    ) -> None:
        """For each groups, update status to `status` and create an Activity."""
        from sentry.models.activity import Activity

        modified_groups_list = []
        selected_groups = Group.objects.filter(id__in=[g.id for g in groups]).exclude(
            status=status, substatus=substatus
        )

        should_update_priority = (
            from_substatus == GroupSubStatus.ESCALATING
            and activity_type == ActivityType.AUTO_SET_ONGOING
        )

        updated_priority = {}
        for group in selected_groups:
            group.status = status
            group.substatus = substatus
            if should_update_priority:
                priority = get_priority_for_ongoing_group(group)
                if priority and group.priority != priority:
                    group.priority = priority
                    updated_priority[group.id] = priority

            modified_groups_list.append(group)

        Group.objects.bulk_update(modified_groups_list, ["status", "substatus", "priority"])

        for group in modified_groups_list:
            Activity.objects.create_group_activity(
                group,
                activity_type,
                data=activity_data,
                send_notification=send_activity_notification,
            )
            record_group_history_from_activity_type(group, activity_type.value)

            if group.id in updated_priority:
                new_priority = updated_priority[group.id]
                Activity.objects.create_group_activity(
                    group=group,
                    type=ActivityType.SET_PRIORITY,
                    data={
                        "priority": new_priority.to_str(),
                        "reason": PriorityChangeReason.ONGOING,
                    },
                )
                record_group_history(group, PRIORITY_TO_GROUP_HISTORY_STATUS[new_priority])

    def from_share_id(self, share_id: str) -> Group:
        if not share_id or len(share_id) != 32:
            raise Group.DoesNotExist

        from sentry.models.groupshare import GroupShare

        return self.get(id__in=GroupShare.objects.filter(uuid=share_id).values_list("group_id")[:1])

    def filter_to_team(self, team):
        from sentry.models.groupassignee import GroupAssignee
        from sentry.models.project import Project

        project_list = Project.objects.get_for_team_ids(team_ids=[team.id])
        user_ids = list(team.member_set.values_list("user_id", flat=True))
        assigned_groups = GroupAssignee.objects.filter(
            Q(team=team) | Q(user_id__in=user_ids)
        ).values_list("group_id", flat=True)
        return self.filter(
            project__in=project_list,
            id__in=assigned_groups,
        )

    def get_issues_mapping(
        self,
        group_ids: Iterable[int],
        project_ids: Sequence[int],
        organization: Organization,
    ) -> Mapping[int, str | None]:
        """Create a dictionary of group_ids to their qualified_short_ids."""
        return {
            i.id: i.qualified_short_id
            for i in self.filter(
                id__in=group_ids, project_id__in=project_ids, project__organization=organization
            )
        }


@region_silo_model
class Group(Model):
    """
    Aggregated message which summarizes a set of Events.
    """

    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project")
    logger = models.CharField(
        max_length=64, blank=True, default=str(DEFAULT_LOGGER_NAME), db_index=True
    )
    level = BoundedPositiveIntegerField(
        choices=[(key, str(val)) for key, val in sorted(LOG_LEVELS.items())],
        default=logging.ERROR,
        blank=True,
        db_index=True,
    )
    message = models.TextField()
    culprit = models.CharField(
        max_length=MAX_CULPRIT_LENGTH, blank=True, null=True, db_column="view"
    )
    num_comments = BoundedPositiveIntegerField(default=0, null=True)
    platform = models.CharField(max_length=64, null=True)
    status = BoundedPositiveIntegerField(
        default=GroupStatus.UNRESOLVED,
        choices=(
            (GroupStatus.UNRESOLVED, _("Unresolved")),
            (GroupStatus.RESOLVED, _("Resolved")),
            (GroupStatus.IGNORED, _("Ignored")),
        ),
        db_index=True,
    )
    substatus = BoundedIntegerField(
        null=True,
        choices=(
            (GroupSubStatus.UNTIL_ESCALATING, _("Until escalating")),
            (GroupSubStatus.ONGOING, _("Ongoing")),
            (GroupSubStatus.ESCALATING, _("Escalating")),
            (GroupSubStatus.UNTIL_CONDITION_MET, _("Until condition met")),
            (GroupSubStatus.FOREVER, _("Forever")),
        ),
    )
    times_seen = BoundedPositiveIntegerField(default=1, db_index=True)
    last_seen = models.DateTimeField(default=timezone.now, db_index=True)
    first_seen = models.DateTimeField(default=timezone.now, db_index=True)
    first_release = FlexibleForeignKey("sentry.Release", null=True, on_delete=models.PROTECT)
    resolved_at = models.DateTimeField(null=True, db_index=True)
    # active_at should be the same as first_seen by default
    active_at = models.DateTimeField(null=True, db_index=True)
    time_spent_total = BoundedIntegerField(default=0)
    time_spent_count = BoundedIntegerField(default=0)
    # deprecated, do not use. GroupShare has superseded
    is_public = models.BooleanField(default=False, null=True)
    data: models.Field[dict[str, Any] | None, dict[str, Any]] = GzippedDictField(
        blank=True, null=True
    )
    short_id = BoundedBigIntegerField(null=True)
    type = BoundedPositiveIntegerField(default=DEFAULT_TYPE_ID, db_index=True)
    priority = models.PositiveSmallIntegerField(null=True)
    priority_locked_at = models.DateTimeField(null=True)

    objects: ClassVar[GroupManager] = GroupManager(cache_fields=("id",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupedmessage"
        verbose_name_plural = _("grouped messages")
        verbose_name = _("grouped message")
        permissions = (("can_view", "Can view"),)
        indexes = [
            models.Index(fields=("project", "first_release")),
            models.Index(fields=("project", "id")),
            models.Index(fields=("project", "status", "last_seen", "id")),
            models.Index(fields=("project", "status", "type", "last_seen", "id")),
            models.Index(fields=("project", "status", "substatus", "last_seen", "id")),
            models.Index(fields=("project", "status", "substatus", "type", "last_seen", "id")),
            models.Index(fields=("project", "status", "substatus", "id")),
            models.Index(fields=("status", "substatus", "id")),  # TODO: Remove this
            models.Index(fields=("status", "substatus", "first_seen")),
            models.Index(fields=("project", "status", "priority", "last_seen", "id")),
        ]
        unique_together = (
            ("project", "short_id"),
            ("project", "id"),
        )

    __repr__ = sane_repr("project_id")

    def __str__(self):
        return f"({self.times_seen}) {self.title}"

    def save(self, *args, **kwargs):
        if not self.last_seen:
            self.last_seen = timezone.now()
        if not self.first_seen:
            self.first_seen = self.last_seen
        if not self.active_at:
            self.active_at = self.first_seen
        # We limit what we store for the message body
        self.message = strip(self.message)
        if self.message:
            self.message = truncatechars(self.message.splitlines()[0], 255)
        if self.times_seen is None:
            self.times_seen = 1
        super().save(*args, **kwargs)

    def get_absolute_url(
        self,
        params: Mapping[str, str] | None = None,
        event_id: str | None = None,
    ) -> str:
        # Built manually in preference to django.urls.reverse,
        # because reverse has a measured performance impact.
        organization = self.organization

        if self.issue_category == GroupCategory.FEEDBACK:
            path = f"/organizations/{organization.slug}/feedback/"
            params = {
                **(params or {}),
                "feedbackSlug": f"{self.project.slug}:{self.id}",
                "project": str(self.project.id),
            }
            query = urlencode(params)
            return organization.absolute_url(path, query=query)
        else:
            path = f"/organizations/{organization.slug}/issues/{self.id}/"
            if event_id:
                path += f"events/{event_id}/"
            query = None
            if params:
                query = urlencode(params)
            return organization.absolute_url(path, query=query)

    @property
    def qualified_short_id(self):
        if self.short_id is not None:
            return f"{self.project.slug.upper()}-{base32_encode(self.short_id)}"

    def is_over_resolve_age(self):
        resolve_age = self.project.get_option("sentry:resolve_age", None)
        if not resolve_age:
            return False
        return self.last_seen < timezone.now() - timedelta(hours=int(resolve_age))

    def is_ignored(self):
        return self.get_status() == GroupStatus.IGNORED

    def is_unresolved(self):
        return self.get_status() == GroupStatus.UNRESOLVED

    # TODO(dcramer): remove in 9.0 / after plugins no long ref
    is_muted = is_ignored

    def is_resolved(self):
        return self.get_status() == GroupStatus.RESOLVED

    def has_replays(self):
        def make_snuba_params_for_replay_count_query():
            return SnubaParams(
                organization=self.project.organization,
                projects=[self.project],
                user=None,
                start=datetime.now() - timedelta(days=14),
                end=datetime.now(),
                environments=[],
                teams=[],
            )

        def _cache_key(issue_id):
            return f"group:has_replays:{issue_id}"

        from sentry.replays.usecases.replay_counts import get_replay_counts
        from sentry.search.events.types import SnubaParams

        metrics.incr("group.has_replays")

        # XXX(jferg) Note that this check will preclude backend projects from receiving the "View Replays"
        # link in their notification. This will need to be addressed in a future change.
        if not self.project.flags.has_replays:
            metrics.incr("group.has_replays.project_has_replays_false")
            return False

        cached_has_replays = cache.get(_cache_key(self.id))
        if cached_has_replays is not None:
            metrics.incr(
                "group.has_replays.cached",
                tags={
                    "has_replays": cached_has_replays,
                },
            )
            return cached_has_replays

        data_source = (
            Dataset.IssuePlatform
            if self.issue_category == GroupCategory.PERFORMANCE
            else Dataset.Discover
        )

        counts = get_replay_counts(
            make_snuba_params_for_replay_count_query(),
            f"issue.id:[{self.id}]",
            return_ids=False,
            data_source=data_source,
        )

        has_replays = counts.get(self.id, 0) > 0  # type: ignore[call-overload]
        # need to refactor counts so that the type of the key returned in the dict is always a str
        # for typing
        metrics.incr(
            "group.has_replays.replay_count_query",
            tags={
                "has_replays": has_replays,
            },
        )
        cache.set(_cache_key(self.id), has_replays, 300)

        return has_replays

    def get_status(self):
        # XXX(dcramer): GroupSerializer reimplements this logic
        from sentry.models.groupsnooze import GroupSnooze

        status = self.status

        if status == GroupStatus.IGNORED:
            try:
                snooze = GroupSnooze.objects.get_from_cache(group=self)
            except GroupSnooze.DoesNotExist:
                pass
            else:
                if not snooze.is_valid(group=self):
                    status = GroupStatus.UNRESOLVED

        if status == GroupStatus.UNRESOLVED and self.is_over_resolve_age():
            return GroupStatus.RESOLVED
        return status

    def get_share_id(self):
        from sentry.models.groupshare import GroupShare

        try:
            return GroupShare.objects.filter(group_id=self.id).values_list("uuid", flat=True)[0]
        except IndexError:
            # Otherwise it has not been shared yet.
            return None

    def get_latest_event(
        self,
        conditions: Sequence[Condition] | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> GroupEvent | None:
        """
        Returns the latest/newest event given the conditions and time range.
        If no event is found, returns None.
        """
        return get_oldest_or_latest_event(
            group=self,
            ordering=EventOrdering.LATEST,
            conditions=conditions,
            start=start,
            end=end,
        )

    def get_latest_event_for_environments(
        self, environments: Sequence[str] = ()
    ) -> GroupEvent | None:
        """
        Legacy special case of `self.get_latest_event` for environments and no date range.
        Kept for compatability, but it's advised to use `self.get_latest_event` directly.
        """
        conditions = (
            [Condition(Column("environment"), Op.IN, environments)] if len(environments) > 0 else []
        )
        return self.get_latest_event(conditions=conditions)

    def get_oldest_event(
        self,
        conditions: Sequence[Condition] | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> GroupEvent | None:
        """
        Returns the oldest event given the conditions and time range.
        If no event is found, returns None.
        """
        return get_oldest_or_latest_event(
            group=self,
            ordering=EventOrdering.OLDEST,
            conditions=conditions,
            start=start,
            end=end,
        )

    def get_oldest_event_for_environments(
        self, environments: Sequence[str] = ()
    ) -> GroupEvent | None:
        """
        Legacy special case of `self.get_oldest_event` for environments and no date range.
        Kept for compatability, but it's advised to use `self.get_oldest_event` directly.
        """
        conditions = (
            [Condition(Column("environment"), Op.IN, environments)] if len(environments) > 0 else []
        )
        return self.get_oldest_event(conditions=conditions)

    def get_recommended_event(
        self,
        conditions: Sequence[Condition] | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
    ) -> GroupEvent | None:
        """
        Returns a recommended event given the conditions and time range.
        If a helpful recommendation is not found, it will fallback to the latest event.
        If neither are found, returns None.
        """
        maybe_event = get_recommended_event(
            group=self,
            conditions=conditions,
            start=start,
            end=end,
        )
        return (
            maybe_event
            if maybe_event
            else self.get_latest_event(conditions=conditions, start=start, end=end)
        )

    def get_recommended_event_for_environments(
        self,
        environments: Sequence[Environment] = (),
        conditions: Sequence[Condition] | None = None,
    ) -> GroupEvent | None:
        """
        Legacy special case of `self.get_recommended_event` for environments and no date range.
        Kept for compatability, but it's advised to use `self.get_recommended_event` directly.
        """
        all_conditions: list[Condition] = list(conditions) if conditions else []
        if len(environments) > 0:
            all_conditions.append(
                Condition(Column("environment"), Op.IN, [e.name for e in environments])
            )
        return self.get_recommended_event(conditions=all_conditions)

    def get_suspect_commit(self) -> Commit | None:
        from sentry.models.groupowner import GroupOwner, GroupOwnerType

        suspect_commit_owner = (
            GroupOwner.objects.filter(
                group_id=self.id,
                project_id=self.project_id,
                type=GroupOwnerType.SUSPECT_COMMIT.value,
                context__isnull=False,
            )
            .order_by("-date_added")
            .first()
        )

        if not suspect_commit_owner:
            return None

        commit_id = suspect_commit_owner.context.get("commitId")
        if not commit_id:
            return None

        commit = Commit.objects.filter(id=commit_id)
        return commit.first()

    def get_first_release(self) -> str | None:
        from sentry.models.release import Release

        if self.first_release is None:
            return Release.objects.get_group_release_version(self.project_id, self.id)

        return self.first_release.version

    def get_last_release(self, use_cache: bool = True) -> str | None:
        from sentry.models.release import Release

        return Release.objects.get_group_release_version(
            project_id=self.project_id,
            group_id=self.id,
            first=False,
            use_cache=use_cache,
        )

    def get_event_type(self):
        """
        Return the type of this issue.

        See ``sentry.eventtypes``.
        """
        return self.data.get("type", "default")

    def get_event_metadata(self) -> Mapping[str, Any]:
        """
        Return the metadata of this issue.

        See ``sentry.eventtypes``.
        """
        return self.data["metadata"]

    @property
    def title(self) -> str:
        title = self.data.get("title")
        event_type = self.get_event_type()

        # TODO: It may be that we don't have to restrict this to just default and error types
        if title and event_type in ["default", "error"]:
            return title

        event_type_instance = eventtypes.get(event_type)()
        return event_type_instance.get_title(self.get_event_metadata())

    def location(self):
        et = eventtypes.get(self.get_event_type())()
        return et.get_location(self.get_event_metadata())

    @property
    def message_short(self):
        warnings.warn("Group.message_short is deprecated, use Group.title", DeprecationWarning)
        return self.title

    @property
    def organization(self):
        return self.project.organization

    @property
    def sdk(self) -> str | None:
        """returns normalized SDK name"""

        try:
            return self.get_event_metadata()["sdk"]["name_normalized"]
        except KeyError:
            return None

    @property
    def checksum(self):
        warnings.warn("Group.checksum is no longer used", DeprecationWarning)
        return ""

    def get_email_subject(self):
        return f"{self.qualified_short_id} - {self.title}"

    def count_users_seen(
        self,
        referrer=Referrer.TAGSTORE_GET_GROUPS_USER_COUNTS.value,
        environment_ids: list[int] | None = None,
    ):
        return tagstore.backend.get_groups_user_counts(
            [self.project_id],
            [self.id],
            environment_ids=environment_ids,
            start=self.first_seen,
            tenant_ids={"organization_id": self.project.organization_id},
            referrer=referrer,
        )[self.id]

    def get_assignee(self) -> Team | RpcUser | None:
        from sentry.models.groupassignee import GroupAssignee

        try:
            group_assignee = GroupAssignee.objects.get(group=self)
        except GroupAssignee.DoesNotExist:
            return None

        assigned_actor: Actor = group_assignee.assigned_actor()

        return assigned_actor.resolve()

    @property
    def times_seen_with_pending(self) -> int:
        """
        Returns `times_seen` with any additional pending updates from `buffers` added on. This value
        must be set first.
        """
        return self.times_seen + self.times_seen_pending

    @property
    def times_seen_pending(self) -> int:
        assert hasattr(self, "_times_seen_pending")
        if not hasattr(self, "_times_seen_pending"):
            logger.error("Attempted to fetch pending `times_seen` value without first setting it")

        return getattr(self, "_times_seen_pending", 0)

    @times_seen_pending.setter
    def times_seen_pending(self, times_seen: int):
        self._times_seen_pending = times_seen

    @property
    def issue_type(self):
        return get_group_type_by_type_id(self.type)

    @property
    def issue_category(self):
        return GroupCategory(self.issue_type.category)


@receiver(pre_save, sender=Group, dispatch_uid="pre_save_group_default_substatus", weak=False)
def pre_save_group_default_substatus(instance, sender, *args, **kwargs):
    # TODO(snigdha): Replace the logging with a ValueError once we are confident that this is working as expected.
    if instance:
        if instance.status == GroupStatus.IGNORED:
            if instance.substatus not in IGNORED_SUBSTATUS_CHOICES:
                logger.error(
                    "Invalid substatus for IGNORED group.", extra={"substatus": instance.substatus}
                )
        elif instance.status == GroupStatus.UNRESOLVED:
            if instance.substatus not in UNRESOLVED_SUBSTATUS_CHOICES:
                logger.error(
                    "Invalid substatus for UNRESOLVED group",
                    extra={"substatus": instance.substatus},
                )
        # We only support substatuses for UNRESOLVED and IGNORED groups
        elif instance.substatus is not None:
            logger.error(
                "No substatus allowed for group",
                extra={"status": instance.status, "substatus": instance.substatus},
            )
