import logging
import math
import re
import warnings
from collections import defaultdict, namedtuple
from datetime import timedelta
from enum import Enum
from functools import reduce
from operator import or_
from typing import TYPE_CHECKING, List, Mapping, Optional, Sequence, Set, Union

from django.core.cache import cache
from django.db import models
from django.db.models import Q, QuerySet
from django.utils import timezone
from django.utils.http import urlencode, urlquote
from django.utils.translation import ugettext_lazy as _

from sentry import eventstore, eventtypes, tagstore
from sentry.constants import DEFAULT_LOGGER_NAME, LOG_LEVELS, MAX_CULPRIT_LENGTH
from sentry.db.models import (
    BaseManager,
    BoundedBigIntegerField,
    BoundedIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    sane_repr,
)
from sentry.eventstore.models import Event
from sentry.types.activity import ActivityType
from sentry.utils.http import absolute_uri
from sentry.utils.numbers import base32_decode, base32_encode
from sentry.utils.strings import strip, truncatechars

if TYPE_CHECKING:
    from sentry.models import Integration, Team, User

logger = logging.getLogger(__name__)

_short_id_re = re.compile(r"^(.*?)(?:[\s_-])([A-Za-z0-9]+)$")

ShortId = namedtuple("ShortId", ["project_slug", "short_id"])


def parse_short_id(short_id):
    match = _short_id_re.match(short_id.strip())
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

    if not (
        isinstance(id_or_qualified_short_id, int) or id_or_qualified_short_id.isdigit()  # noqa
    ):  # NOQA
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
        from sentry.models import GroupRedirect

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


# Statuses that can be queried/searched for
STATUS_QUERY_CHOICES = {
    "resolved": GroupStatus.RESOLVED,
    "unresolved": GroupStatus.UNRESOLVED,
    "ignored": GroupStatus.IGNORED,
    # TODO(dcramer): remove in 9.0
    "muted": GroupStatus.IGNORED,
    "reprocessing": GroupStatus.REPROCESSING,
}
QUERY_STATUS_LOOKUP = {
    status: query for query, status in STATUS_QUERY_CHOICES.items() if query != "muted"
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


def get_oldest_or_latest_event_for_environments(
    ordering, environments=(), issue_id=None, project_id=None
) -> Optional[Event]:
    conditions = []

    if len(environments) > 0:
        conditions.append(["environment", "IN", environments])

    events = eventstore.get_events(
        filter=eventstore.Filter(
            conditions=conditions, project_ids=[project_id], group_ids=[issue_id]
        ),
        limit=1,
        orderby=ordering.value,
        referrer="Group.get_latest",
    )

    if events:
        return events[0]

    return None


class GroupManager(BaseManager):
    use_for_related_fields = True

    def by_qualified_short_id(self, organization_id: int, short_id: str):
        return self.by_qualified_short_id_bulk(organization_id, [short_id])[0]

    def by_qualified_short_id_bulk(self, organization_id: int, short_ids: List[str]):
        short_ids = [parse_short_id(short_id) for short_id in short_ids]
        if not short_ids or any(short_id is None for short_id in short_ids):
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

        groups: List[Group] = list(
            Group.objects.exclude(
                status__in=[
                    GroupStatus.PENDING_DELETION,
                    GroupStatus.DELETION_IN_PROGRESS,
                    GroupStatus.PENDING_MERGE,
                ]
            ).filter(short_id_lookup, project__organization=organization_id)
        )
        group_lookup: Set[int] = {group.short_id for group in groups}
        for short_id in short_ids:
            if short_id.short_id not in group_lookup:
                raise Group.DoesNotExist()
        return groups

    def from_kwargs(self, project, **kwargs):
        from sentry.event_manager import EventManager, HashDiscarded

        manager = EventManager(kwargs)
        manager.normalize()
        try:
            return manager.save(project)

        # TODO(jess): this method maybe isn't even used?
        except HashDiscarded as e:
            logger.info("discarded.hash", extra={"project_id": project, "description": str(e)})

    def from_event_id(self, project, event_id):
        """
        Resolves the 32 character event_id string into
        a Group for which it is found.
        """
        group_id = None

        event = eventstore.get_event_by_id(project.id, event_id)

        if event:
            group_id = event.group_id

        if group_id is None:
            # Raise a Group.DoesNotExist here since it makes
            # more logical sense since this is intending to resolve
            # a Group.
            raise Group.DoesNotExist()

        return Group.objects.get(id=group_id)

    def filter_by_event_id(self, project_ids, event_id):
        event_ids = [event_id]
        conditions = [["group_id", "IS NOT NULL", None]]
        data = eventstore.get_events(
            filter=eventstore.Filter(
                event_ids=event_ids, project_ids=project_ids, conditions=conditions
            ),
            limit=max(len(project_ids), 100),
            referrer="Group.filter_by_event_id",
        )

        group_ids = {evt.group_id for evt in data}

        return Group.objects.filter(id__in=group_ids)

    def get_groups_by_external_issue(
        self,
        integration: "Integration",
        external_issue_key: str,
    ) -> QuerySet:
        from sentry.models import ExternalIssue, GroupLink

        return self.filter(
            id__in=GroupLink.objects.filter(
                linked_id__in=ExternalIssue.objects.filter(
                    key=external_issue_key,
                    integration_id=integration.id,
                    organization_id__in=integration.organizations.values_list("id", flat=True),
                ).values_list("id", flat=True)
            ).values_list("group_id", flat=True),
            project__organization_id__in=integration.organizations.values_list("id", flat=True),
        )

    def update_group_status(
        self, groups: Sequence["Group"], status: GroupStatus, activity_type: ActivityType
    ) -> None:
        """For each groups, update status to `status` and create an Activity."""
        from sentry.models import Activity

        updated_count = (
            self.filter(id__in=[g.id for g in groups]).exclude(status=status).update(status=status)
        )
        if updated_count:
            for group in groups:
                Activity.objects.create_group_activity(group, activity_type)

    def from_share_id(self, share_id: str) -> "Group":
        if not share_id or len(share_id) != 32:
            raise Group.DoesNotExist

        from sentry.models import GroupShare

        return self.get(id__in=GroupShare.objects.filter(uuid=share_id).values_list("group_id")[:1])


class Group(Model):
    """
    Aggregated message which summarizes a set of Events.
    """

    __include_in_export__ = False

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
        default=0,
        choices=(
            (GroupStatus.UNRESOLVED, _("Unresolved")),
            (GroupStatus.RESOLVED, _("Resolved")),
            (GroupStatus.IGNORED, _("Ignored")),
        ),
        db_index=True,
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
    score = BoundedIntegerField(default=0)
    # deprecated, do not use. GroupShare has superseded
    is_public = models.NullBooleanField(default=False, null=True)
    data = GzippedDictField(blank=True, null=True)
    short_id = BoundedBigIntegerField(null=True)

    objects = GroupManager(cache_fields=("id",))

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupedmessage"
        verbose_name_plural = _("grouped messages")
        verbose_name = _("grouped message")
        permissions = (("can_view", "Can view"),)
        index_together = [
            ("project", "first_release"),
            ("project", "id"),
            ("project", "status", "last_seen", "id"),
        ]
        unique_together = (
            ("project", "short_id"),
            ("project", "id"),
        )

    __repr__ = sane_repr("project_id")

    def __str__(self):
        return f"({self.times_seen}) {self.error()}"

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
        self.score = type(self).calculate_score(
            times_seen=self.times_seen, last_seen=self.last_seen
        )
        super().save(*args, **kwargs)

    def get_absolute_url(
        self,
        params: Optional[Mapping[str, str]] = None,
        event_id: Optional[int] = None,
        organization_slug: Optional[str] = None,
    ) -> str:
        # Built manually in preference to django.urls.reverse,
        # because reverse has a measured performance impact.
        event_path = f"events/{event_id}/" if event_id else ""
        url = "organizations/{org}/issues/{id}/{event_path}{params}".format(
            # Pass organization_slug if this needs to be called multiple times to avoid n+1 queries
            org=urlquote(
                self.organization.slug if organization_slug is None else organization_slug
            ),
            id=self.id,
            event_path=event_path,
            params="?" + urlencode(params) if params else "",
        )
        return absolute_uri(url)

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

    def get_status(self):
        # XXX(dcramer): GroupSerializer reimplements this logic
        from sentry.models import GroupSnooze

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
        from sentry.models import GroupShare

        try:
            return GroupShare.objects.filter(group_id=self.id).values_list("uuid", flat=True)[0]
        except IndexError:
            # Otherwise it has not been shared yet.
            return None

    def get_score(self):
        return type(self).calculate_score(self.times_seen, self.last_seen)

    def get_latest_event(self) -> Optional[Event]:
        if not hasattr(self, "_latest_event"):
            self._latest_event = self.get_latest_event_for_environments()

        return self._latest_event

    def get_latest_event_for_environments(self, environments=()):
        return get_oldest_or_latest_event_for_environments(
            EventOrdering.LATEST,
            environments=environments,
            issue_id=self.id,
            project_id=self.project_id,
        )

    def get_oldest_event_for_environments(self, environments=()):
        return get_oldest_or_latest_event_for_environments(
            EventOrdering.OLDEST,
            environments=environments,
            issue_id=self.id,
            project_id=self.project_id,
        )

    def _get_cache_key(self, project_id, group_id, first):
        return f"g-r:{group_id}-{project_id}-{first}"

    def __get_release(self, project_id, group_id, first=True, use_cache=True):
        from sentry.models import GroupRelease, Release

        orderby = "first_seen" if first else "-last_seen"
        cache_key = self._get_cache_key(project_id, group_id, first)
        try:
            release_version = cache.get(cache_key) if use_cache else None
            if release_version is None:
                release_version = Release.objects.get(
                    id__in=GroupRelease.objects.filter(group_id=group_id)
                    .order_by(orderby)
                    .values("release_id")[:1]
                ).version
                cache.set(cache_key, release_version, 3600)
            elif release_version is False:
                release_version = None
            return release_version
        except Release.DoesNotExist:
            cache.set(cache_key, False, 3600)
            return None

    def get_first_release(self):
        if self.first_release_id is None:
            first_release = self.__get_release(self.project_id, self.id, True)
            return first_release

        return self.first_release.version

    def get_last_release(self, use_cache=True):
        return self.__get_release(self.project_id, self.id, False, use_cache=use_cache)

    def get_event_type(self):
        """
        Return the type of this issue.

        See ``sentry.eventtypes``.
        """
        return self.data.get("type", "default")

    def get_event_metadata(self) -> Mapping[str, str]:
        """
        Return the metadata of this issue.

        See ``sentry.eventtypes``.
        """
        return self.data["metadata"]

    @property
    def title(self) -> str:
        et = eventtypes.get(self.get_event_type())()
        return et.get_title(self.get_event_metadata())

    def location(self):
        et = eventtypes.get(self.get_event_type())()
        return et.get_location(self.get_event_metadata())

    def error(self):
        warnings.warn("Group.error is deprecated, use Group.title", DeprecationWarning)
        return self.title

    error.short_description = _("error")

    @property
    def message_short(self):
        warnings.warn("Group.message_short is deprecated, use Group.title", DeprecationWarning)
        return self.title

    @property
    def organization(self):
        return self.project.organization

    @property
    def checksum(self):
        warnings.warn("Group.checksum is no longer used", DeprecationWarning)
        return ""

    def get_email_subject(self):
        return f"{self.qualified_short_id} - {self.title}"

    def count_users_seen(self):
        return tagstore.get_groups_user_counts(
            [self.project_id], [self.id], environment_ids=None, start=self.first_seen
        )[self.id]

    @classmethod
    def calculate_score(cls, times_seen, last_seen):
        return math.log(float(times_seen or 1)) * 600 + float(last_seen.strftime("%s"))

    @staticmethod
    def issues_mapping(group_ids, project_ids, organization):
        """Create a dictionary of group_ids to their qualified_short_ids"""
        return {
            i.id: i.qualified_short_id
            for i in Group.objects.filter(
                id__in=group_ids, project_id__in=project_ids, project__organization=organization
            )
        }

    def get_assignee(self) -> Optional[Union["Team", "User"]]:
        from sentry.models import GroupAssignee

        try:
            group_assignee = GroupAssignee.objects.get(group=self)
        except GroupAssignee.DoesNotExist:
            return None

        assigned_actor = group_assignee.assigned_actor()

        try:
            return assigned_actor.resolve()
        except assigned_actor.type.DoesNotExist:
            return None
