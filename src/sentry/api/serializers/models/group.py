from __future__ import annotations

import itertools
import logging
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import Callable, Iterable, Mapping, MutableMapping, Sequence
from datetime import datetime, timedelta, timezone
from typing import Any, Protocol, TypedDict, TypeGuard

import sentry_sdk
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.db.models import Min, prefetch_related_objects

from sentry import tagstore
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.actor import ActorSerializer
from sentry.api.serializers.models.plugin import is_plugin_deprecated
from sentry.app import env
from sentry.auth.superuser import is_active_superuser
from sentry.constants import LOG_LEVELS
from sentry.integrations.mixins.issues import IssueBasicIntegration
from sentry.integrations.services.integration import integration_service
from sentry.issues.grouptype import GroupCategory
from sentry.models.commit import Commit
from sentry.models.environment import Environment
from sentry.models.group import Group, GroupStatus
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupbookmark import GroupBookmark
from sentry.models.groupenvironment import GroupEnvironment
from sentry.models.grouplink import GroupLink
from sentry.models.groupmeta import GroupMeta
from sentry.models.groupresolution import GroupResolution
from sentry.models.groupseen import GroupSeen
from sentry.models.groupshare import GroupShare
from sentry.models.groupsnooze import GroupSnooze
from sentry.models.groupsubscription import GroupSubscription
from sentry.models.organizationmember import OrganizationMember
from sentry.models.orgauthtoken import is_org_auth_token_auth
from sentry.models.team import Team
from sentry.notifications.helpers import (
    SubscriptionDetails,
    collect_groups_by_project,
    get_subscription_from_attributes,
)
from sentry.notifications.services import notifications_service
from sentry.notifications.types import NotificationSettingEnum
from sentry.reprocessing2 import get_progress
from sentry.search.events.constants import RELEASE_STAGE_ALIAS
from sentry.search.events.filter import convert_search_filter_to_snuba_query, format_search_filter
from sentry.snuba.dataset import Dataset
from sentry.tagstore.snuba.backend import fix_tag_value_data
from sentry.tagstore.types import GroupTagValue
from sentry.tsdb.snuba import SnubaTSDB
from sentry.types.group import SUBSTATUS_TO_STR, PriorityLevel
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service
from sentry.utils.cache import cache
from sentry.utils.safe import safe_execute
from sentry.utils.snuba import aliased_query, raw_query

# TODO(jess): remove when snuba is primary backend
snuba_tsdb = SnubaTSDB(**settings.SENTRY_TSDB_OPTIONS)


logger = logging.getLogger(__name__)


def merge_list_dictionaries(
    dict1: MutableMapping[Any, list[Any]], dict2: Mapping[Any, Sequence[Any]]
):
    for key, val in dict2.items():
        dict1.setdefault(key, []).extend(val)


class GroupAnnotation(TypedDict):
    displayName: str
    url: str


class GroupStatusDetailsResponseOptional(TypedDict, total=False):
    autoResolved: bool
    ignoreCount: int
    ignoreUntil: datetime
    ignoreUserCount: int
    ignoreUserWindow: int
    ignoreWindow: int
    actor: UserSerializerResponse
    inNextRelease: bool
    inRelease: str
    inCommit: str
    pendingEvents: int
    info: Any


class GroupProjectResponse(TypedDict):
    id: str
    name: str
    slug: str
    platform: str | None


class BaseGroupResponseOptional(TypedDict, total=False):
    isUnhandled: bool
    count: int
    userCount: int
    firstSeen: datetime
    lastSeen: datetime


class BaseGroupSerializerResponse(BaseGroupResponseOptional):
    id: str
    shareId: str
    shortId: str
    title: str
    culprit: str | None
    permalink: str
    logger: str | None
    level: str
    status: str
    statusDetails: GroupStatusDetailsResponseOptional
    substatus: str | None
    isPublic: bool
    platform: str | None
    priority: str | None
    priorityLockedAt: datetime | None
    project: GroupProjectResponse
    type: str
    issueType: str
    issueCategory: str
    metadata: Mapping[str, Any]
    numComments: int
    assignedTo: UserSerializerResponse
    isBookmarked: bool
    isSubscribed: bool
    subscriptionDetails: SubscriptionDetails | None
    hasSeen: bool
    annotations: Sequence[GroupAnnotation]


class SeenStats(TypedDict):
    times_seen: int
    first_seen: datetime | None
    last_seen: datetime | None
    user_count: int


def is_seen_stats(o: object) -> TypeGuard[SeenStats]:
    # not a perfect check, but simulates what was being validated before
    return isinstance(o, dict) and "times_seen" in o


class GroupSerializerBase(Serializer, ABC):
    def __init__(
        self,
        collapse=None,
        expand=None,
    ):
        self.collapse = collapse
        self.expand = expand

    def _serialize_assignees(self, item_list: Sequence[Group]) -> Mapping[int, Team | Any]:
        gas = GroupAssignee.objects.filter(group__in=item_list)
        result: MutableMapping[int, Team | Any] = {}
        all_team_ids: MutableMapping[int, set[int]] = defaultdict(set)
        all_user_ids: MutableMapping[int, set[int]] = defaultdict(set)

        for g in gas:
            if g.team_id:
                all_team_ids[g.team_id].add(g.group_id)
            if g.user_id:
                all_user_ids[g.user_id].add(g.group_id)

        for team in Team.objects.filter(id__in=all_team_ids.keys()):
            for group_id in all_team_ids[team.id]:
                result[group_id] = team

        user_ids = list(all_user_ids.keys())
        if user_ids:
            for user in user_service.get_many_by_id(ids=user_ids):
                for group_id in all_user_ids[user.id]:
                    result[group_id] = user

        return result

    def get_attrs(
        self, item_list: Sequence[Group], user: User | RpcUser | AnonymousUser, **kwargs: Any
    ) -> dict[Group, dict[str, Any]]:
        GroupMeta.objects.populate_cache(item_list)

        # Note that organization is necessary here for use in `_get_permalink` to avoid
        # making unnecessary queries.
        prefetch_related_objects(item_list, "project__organization")

        if user.is_authenticated and item_list:
            bookmarks = set(
                GroupBookmark.objects.filter(user_id=user.id, group__in=item_list).values_list(
                    "group_id", flat=True
                )
            )
            seen_groups = dict(
                GroupSeen.objects.filter(user_id=user.id, group__in=item_list).values_list(
                    "group_id", "last_seen"
                )
            )
            subscriptions = self._get_subscriptions(item_list, user)
        else:
            bookmarks = set()
            seen_groups = {}
            subscriptions = defaultdict(lambda: (False, False, None))

        resolved_assignees = self._serialize_assignees(item_list)

        ignore_items = {g.group_id: g for g in GroupSnooze.objects.filter(group__in=item_list)}

        release_resolutions, commit_resolutions = self._resolve_resolutions(item_list, user)

        user_ids = {
            user_id
            for user_id in itertools.chain(
                (r[-1] for r in release_resolutions.values()),
                (r.actor_id for r in ignore_items.values()),
            )
            if user_id is not None
        }
        if user_ids:
            serialized_users = user_service.serialize_many(
                filter={"user_ids": user_ids, "is_active": True},
                as_user=serialize_generic_user(user),
            )
            actors = {id: u for id, u in zip(user_ids, serialized_users)}
        else:
            actors = {}

        share_ids = dict(
            GroupShare.objects.filter(group__in=item_list).values_list("group_id", "uuid")
        )

        seen_stats = self._get_seen_stats(item_list, user)

        organization_id_list = list({item.project.organization_id for item in item_list})
        # if no groups, then we can't proceed but this seems to be a valid use case
        if not item_list:
            return {}
        if len(organization_id_list) > 1:
            # this should never happen but if it does we should know about it
            logger.warning(
                "Found multiple organizations for groups: %s, with orgs: %s",
                [item.id for item in item_list],
                organization_id_list,
            )

        # should only have 1 org at this point
        organization_id = organization_id_list[0]

        authorized = self._is_authorized(user, organization_id)

        annotations_by_group_id: MutableMapping[int, list[Any]] = defaultdict(list)
        for annotations_by_group in itertools.chain.from_iterable(
            [
                self._resolve_integration_annotations(organization_id, item_list),
                [self._resolve_external_issue_annotations(item_list)],
            ]
        ):
            merge_list_dictionaries(annotations_by_group_id, annotations_by_group)

        snuba_stats = self._get_group_snuba_stats(item_list, seen_stats)

        result = {}
        for item in item_list:
            active_date = item.active_at or item.first_seen

            resolution_actor = None
            resolution_type = None
            resolution = release_resolutions.get(item.id)
            if resolution:
                resolution_type = "release"
                resolution_actor = actors.get(resolution[-1])
            if not resolution:
                resolution = commit_resolutions.get(item.id)
                if resolution:
                    resolution_type = "commit"

            ignore_item = ignore_items.get(item.id)

            result[item] = {
                "id": item.id,
                "assigned_to": resolved_assignees.get(item.id),
                "is_bookmarked": item.id in bookmarks,
                "subscription": subscriptions[item.id],
                "has_seen": seen_groups.get(item.id, active_date) > active_date,
                "annotations": self._resolve_and_extend_plugin_annotation(
                    item, annotations_by_group_id[item.id]
                ),
                "ignore_until": ignore_item,
                "ignore_actor": actors.get(ignore_item.actor_id) if ignore_item else None,
                "resolution": resolution,
                "resolution_type": resolution_type,
                "resolution_actor": resolution_actor,
                "share_id": share_ids.get(item.id),
                "authorized": authorized,
            }
            if snuba_stats is not None:
                result[item]["is_unhandled"] = bool(snuba_stats.get(item.id, {}).get("unhandled"))

            if seen_stats:
                result[item].update(seen_stats.get(item, {}))
        return result

    def serialize(
        self,
        obj: Group,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> BaseGroupSerializerResponse:
        status_details, status_label = self._get_status(attrs, obj)
        permalink = self._get_permalink(attrs, obj)
        is_subscribed, subscription_details = get_subscription_from_attributes(attrs)
        share_id = attrs["share_id"]
        priority_label = PriorityLevel(obj.priority).to_str() if obj.priority else None
        group_dict: BaseGroupSerializerResponse = {
            "id": str(obj.id),
            "shareId": share_id,
            "shortId": obj.qualified_short_id,
            "title": obj.title,
            "culprit": obj.culprit,
            "permalink": permalink,
            "logger": obj.logger or None,
            "level": LOG_LEVELS.get(obj.level, "unknown"),
            "status": status_label,
            "statusDetails": status_details,
            "substatus": SUBSTATUS_TO_STR[obj.substatus] if obj.substatus else None,
            "isPublic": share_id is not None,
            "platform": obj.platform,
            "project": {
                "id": str(obj.project.id),
                "name": obj.project.name,
                "slug": obj.project.slug,
                "platform": obj.project.platform,
            },
            "type": obj.get_event_type(),
            "metadata": obj.get_event_metadata(),
            "numComments": obj.num_comments,
            "assignedTo": serialize(attrs["assigned_to"], user, ActorSerializer()),
            "isBookmarked": attrs["is_bookmarked"],
            "isSubscribed": is_subscribed,
            "subscriptionDetails": subscription_details,
            "hasSeen": attrs["has_seen"],
            "annotations": attrs["annotations"],
            "issueType": obj.issue_type.slug,
            "issueCategory": obj.issue_category.name.lower(),
            "priority": priority_label,
            "priorityLockedAt": obj.priority_locked_at,
        }

        # This attribute is currently feature gated
        if "is_unhandled" in attrs:
            group_dict["isUnhandled"] = attrs["is_unhandled"]
        if is_seen_stats(attrs):
            group_dict.update(self._convert_seen_stats(attrs))
        return group_dict

    @abstractmethod
    def _seen_stats_error(
        self, error_issue_list: Sequence[Group], user
    ) -> Mapping[Group, SeenStats]:
        pass

    @abstractmethod
    def _seen_stats_generic(
        self, generic_issue_list: Sequence[Group], user
    ) -> Mapping[Group, SeenStats]:
        pass

    def _expand(self, key) -> bool:
        if self.expand is None:
            return False

        return key in self.expand

    def _collapse(self, key) -> bool:
        if self.collapse is None:
            return False
        return key in self.collapse

    def _get_status(self, attrs: Mapping[str, Any], obj: Group):
        status = obj.status
        status_details = {}
        if attrs["ignore_until"]:
            snooze = attrs["ignore_until"]
            if snooze.is_valid(group=obj):
                # counts return the delta remaining when window is not set
                status_details.update(
                    {
                        "ignoreCount": (
                            snooze.count - (obj.times_seen - snooze.state["times_seen"])
                            if snooze.count and not snooze.window
                            else snooze.count
                        ),
                        "ignoreUntil": snooze.until,
                        "ignoreUserCount": (
                            snooze.user_count - (attrs["user_count"] - snooze.state["users_seen"])
                            if snooze.user_count
                            and not snooze.user_window
                            and not self._collapse("stats")
                            else snooze.user_count
                        ),
                        "ignoreUserWindow": snooze.user_window,
                        "ignoreWindow": snooze.window,
                        "actor": attrs["ignore_actor"],
                    }
                )
            else:
                status = GroupStatus.UNRESOLVED
        if status == GroupStatus.UNRESOLVED and obj.is_over_resolve_age():
            # When an issue is over the auto-resolve age but the task has not yet run
            status = GroupStatus.RESOLVED
            status_details["autoResolved"] = True
        if status == GroupStatus.RESOLVED:
            status_label = "resolved"
            if attrs["resolution_type"] == "release":
                res_type, res_version, _ = attrs["resolution"]
                if res_type in (GroupResolution.Type.in_next_release, None):
                    status_details["inNextRelease"] = True
                elif res_type == GroupResolution.Type.in_release:
                    status_details["inRelease"] = res_version
                status_details["actor"] = attrs["resolution_actor"]
            elif attrs["resolution_type"] == "commit":
                status_details["inCommit"] = attrs["resolution"]
        elif status == GroupStatus.IGNORED:
            status_label = "ignored"
        elif status in [GroupStatus.PENDING_DELETION, GroupStatus.DELETION_IN_PROGRESS]:
            status_label = "pending_deletion"
        elif status == GroupStatus.PENDING_MERGE:
            status_label = "pending_merge"
        elif status == GroupStatus.REPROCESSING:
            status_label = "reprocessing"
            status_details["pendingEvents"], status_details["info"] = get_progress(
                attrs["id"], obj.project.id
            )
        else:
            status_label = "unresolved"
        return status_details, status_label

    def _get_seen_stats(self, item_list: Sequence[Group], user) -> Mapping[Group, SeenStats] | None:
        """
        Returns a dictionary keyed by item that includes:
            - times_seen
            - first_seen
            - last_seen
            - user_count
        """
        if self._collapse("stats"):
            return None

        if not item_list:
            return None

        # partition the item_list by type
        error_issues = [group for group in item_list if GroupCategory.ERROR == group.issue_category]
        generic_issues = [
            group for group in item_list if group.issue_category != GroupCategory.ERROR
        ]

        # bulk query for the seen_stats by type
        error_stats = (self._seen_stats_error(error_issues, user) if error_issues else {}) or {}
        generic_stats = (
            self._seen_stats_generic(generic_issues, user) if generic_issues else {}
        ) or {}
        agg_stats = {**error_stats, **generic_stats}
        # combine results back
        return {group: agg_stats[group] for group in item_list if group in agg_stats}

    def _get_group_snuba_stats(
        self, item_list: Sequence[Group], seen_stats: Mapping[Group, SeenStats] | None
    ):
        if self._collapse("unhandled") and len(item_list) > 0:
            return None
        start = self._get_start_from_seen_stats(seen_stats)
        unhandled = {}

        cache_keys = []
        for item in item_list:
            cache_keys.append(f"group-mechanism-handled:{item.id}")

        cache_data = cache.get_many(cache_keys)
        for item, cache_key in zip(item_list, cache_keys):
            unhandled[item.id] = cache_data.get(cache_key)

        filter_keys: dict[str, list[int]] = {}
        for item in item_list:
            if unhandled.get(item.id) is not None:
                continue
            filter_keys.setdefault("project_id", []).append(item.project_id)
            filter_keys.setdefault("group_id", []).append(item.id)

        if filter_keys:
            rv = raw_query(
                dataset=Dataset.Events,
                selected_columns=[
                    "group_id",
                    [
                        "argMax",
                        [["has", ["exception_stacks.mechanism_handled", 0]], "timestamp"],
                        "unhandled",
                    ],
                ],
                groupby=["group_id"],
                filter_keys=filter_keys,
                start=start,
                orderby="group_id",
                referrer="group.unhandled-flag",
                tenant_ids=(
                    {"organization_id": item_list[0].project.organization_id} if item_list else None
                ),
            )
            for x in rv["data"]:
                unhandled[x["group_id"]] = x["unhandled"]

                # cache the handled flag for 60 seconds.  This is broadly in line with
                # the time we give for buffer flushes so the user experience is somewhat
                # consistent here.
                cache.set("group-mechanism-handled:%d" % x["group_id"], x["unhandled"], 60)

        return {group_id: {"unhandled": unhandled} for group_id, unhandled in unhandled.items()}

    @staticmethod
    def _get_start_from_seen_stats(seen_stats: Mapping[Group, SeenStats] | None):
        # Try to figure out what is a reasonable time frame to look into stats,
        # based on a given "seen stats".  We try to pick a day prior to the earliest last seen,
        # but it has to be at least 14 days, and not more than 90 days ago.
        # Fallback to the 30 days ago if we are not able to calculate the value.
        last_seen: datetime | None = None
        if seen_stats:
            for item in seen_stats.values():
                if last_seen is None or (item["last_seen"] and last_seen > item["last_seen"]):
                    last_seen = item["last_seen"]

        if last_seen is None:
            return datetime.now(timezone.utc) - timedelta(days=30)

        return max(
            min(last_seen - timedelta(days=1), datetime.now(timezone.utc) - timedelta(days=14)),
            datetime.now(timezone.utc) - timedelta(days=90),
        )

    @staticmethod
    def _get_subscriptions(
        groups: Iterable[Group], user: User | RpcUser
    ) -> dict[int, tuple[bool, bool, GroupSubscription | None]]:
        """
        Returns a mapping of group IDs to a two-tuple of (is_disabled: bool,
        subscribed: bool, subscription: Optional[GroupSubscription]) for the
        provided user and groups.

        Returns:
            Mapping[int, Tuple[bool, bool, Optional[GroupSubscription]]]: A mapping of group IDs to
            a tuple of (is_disabled: bool, subscribed: bool, subscription: Optional[GroupSubscription])
        """
        if not groups:
            return {}

        groups_by_project = collect_groups_by_project(groups)
        project_ids = list(groups_by_project.keys())
        enabled_settings = notifications_service.subscriptions_for_projects(
            user_id=user.id, project_ids=project_ids, type=NotificationSettingEnum.WORKFLOW
        )
        query_groups = {
            group
            for group in groups
            if (not enabled_settings[group.project_id].has_only_inactive_subscriptions)
        }
        subscriptions_by_group_id: dict[int, GroupSubscription] = {
            subscription.group_id: subscription
            for subscription in GroupSubscription.objects.filter(
                group__in=query_groups, user_id=user.id
            )
        }
        groups_by_project = collect_groups_by_project(groups)

        results: dict[int, tuple[bool, bool, GroupSubscription | None]] = {}
        for project_id, group_set in groups_by_project.items():
            subscription_status = enabled_settings[project_id]
            for group in group_set:
                subscription = subscriptions_by_group_id.get(group.id)
                if subscription:
                    # Having a GroupSubscription overrides NotificationSettings.
                    results[group.id] = (False, subscription.is_active, subscription)
                elif subscription_status.is_disabled:
                    # The user has disabled notifications in all cases.
                    results[group.id] = (True, False, None)
                else:
                    # Since there is no subscription, it is only active if the value is ALWAYS.
                    results[group.id] = (False, subscription_status.is_active, None)

        return results

    @staticmethod
    def _resolve_resolutions(
        groups: Sequence[Group], user
    ) -> tuple[Mapping[int, Sequence[Any]], Mapping[int, Any]]:
        resolved_groups = [i for i in groups if i.status == GroupStatus.RESOLVED]
        if not resolved_groups:
            return {}, {}

        _release_resolutions = {
            i[0]: i[1:]
            for i in GroupResolution.objects.filter(group__in=resolved_groups).values_list(
                "group", "type", "release__version", "actor_id"
            )
        }

        # due to our laziness, and django's inability to do a reasonable join here
        # we end up with two queries
        commit_results = list(
            Commit.objects.extra(
                select={"group_id": "sentry_grouplink.group_id"},
                tables=["sentry_grouplink"],
                where=[
                    "sentry_grouplink.linked_id = sentry_commit.id",
                    "sentry_grouplink.group_id IN ({})".format(
                        ", ".join(str(i.id) for i in resolved_groups)
                    ),
                    "sentry_grouplink.linked_type = %s",
                    "sentry_grouplink.relationship = %s",
                ],
                params=[int(GroupLink.LinkedType.commit), int(GroupLink.Relationship.resolves)],
            )
        )
        _commit_resolutions = {
            i.group_id: d for i, d in zip(commit_results, serialize(commit_results, user))  # type: ignore[attr-defined]  # django-stubs
        }

        return _release_resolutions, _commit_resolutions

    @staticmethod
    def _resolve_external_issue_annotations(groups: Sequence[Group]) -> Mapping[int, Sequence[Any]]:
        from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue

        # find the external issues for sentry apps and add them in
        return (
            safe_execute(PlatformExternalIssue.get_annotations_for_group_list, group_list=groups)
            or {}
        )

    @staticmethod
    def _resolve_integration_annotations(
        org_id: int, groups: Sequence[Group]
    ) -> Sequence[Mapping[int, Sequence[Any]]]:
        from sentry.integrations.base import IntegrationFeatures

        integration_annotations = []
        # find all the integration installs that have issue tracking
        integrations = integration_service.get_integrations(organization_id=org_id)
        for integration in integrations:
            if not (
                integration.has_feature(feature=IntegrationFeatures.ISSUE_BASIC)
                or integration.has_feature(feature=IntegrationFeatures.ISSUE_SYNC)
            ):
                continue

            install = integration.get_installation(organization_id=org_id)
            assert isinstance(install, IssueBasicIntegration), install
            local_annotations_by_group_id = (
                safe_execute(install.get_annotations_for_group_list, group_list=groups) or {}
            )
            integration_annotations.append(local_annotations_by_group_id)

        return integration_annotations

    @staticmethod
    def _resolve_and_extend_plugin_annotation(
        item: Group, current_annotations: list[Any]
    ) -> Sequence[Any]:
        from sentry.plugins.base import plugins

        annotations_for_group = []
        annotations_for_group.extend(current_annotations)

        # add the annotations for plugins
        # note that the model GroupMeta(where all the information is stored) is already cached at the start of
        # `get_attrs`, so these for loops doesn't make a bunch of queries
        for plugin in plugins.for_project(project=item.project, version=1):
            if is_plugin_deprecated(plugin, item.project):
                continue
            safe_execute(plugin.tags, None, item, annotations_for_group)
        for plugin in plugins.for_project(project=item.project, version=2):
            annotations_for_group.extend(safe_execute(plugin.get_annotations, group=item) or ())

        return annotations_for_group

    @staticmethod
    def _is_authorized(user, organization_id: int):
        # If user is not logged in and member of the organization,
        # do not return the permalink which contains private information i.e. org name.
        request = env.request
        if request and is_active_superuser(request) and request.user.id == user.id:
            return True

        # If user is a sentry_app then it's a proxy user meaning we can't do a org lookup via `get_orgs()`
        # because the user isn't an org member. Instead we can use the auth token and the installation
        # it's associated with to find out what organization the token has access to.
        if (
            request is not None
            and getattr(request.user, "is_sentry_app", False)
            and request.auth is not None
            and request.auth.kind == "api_token"
            and request.auth.token_has_org_access(organization_id)
        ):
            return True

        if (
            request
            and user.is_anonymous
            and hasattr(request, "auth")
            and is_org_auth_token_auth(request.auth)
        ):
            return request.auth.organization_id == organization_id

        return (
            user.is_authenticated
            and OrganizationMember.objects.filter(
                user_id=user.id, organization_id=organization_id
            ).exists()
        )

    @staticmethod
    def _get_permalink(attrs, obj: Group):
        if attrs["authorized"]:
            with sentry_sdk.start_span(op="GroupSerializerBase.serialize.permalink.build"):
                return obj.get_absolute_url()
        else:
            return None

    @staticmethod
    def _convert_seen_stats(attrs: SeenStats):
        return {
            "count": str(attrs["times_seen"]),
            "userCount": attrs["user_count"],
            "firstSeen": attrs["first_seen"],
            "lastSeen": attrs["last_seen"],
        }


class _GroupUserCountsFunc(Protocol):
    def __call__(
        self,
        project_ids: Sequence[int],
        group_ids: Sequence[int],
        environment_ids: Sequence[int] | None,
        start: datetime | None = None,
        end: datetime | None = None,
        tenant_ids: dict[str, str | int] | None = None,
        referrer: str = ...,
    ) -> Mapping[int, int]: ...


class _EnvironmentSeenStatsFunc(Protocol):
    def __call__(
        self,
        project_ids: Sequence[int],
        group_id_list: Sequence[int],
        environment_ids: Sequence[int],
        key: str,
        value: str,
        tenant_ids: dict[str, str | int] | None = None,
    ) -> Mapping[int, GroupTagValue]: ...


@register(Group)
class GroupSerializer(GroupSerializerBase):
    def __init__(
        self,
        collapse=None,
        expand=None,
        environment_func: Callable[[], Environment | None] | None = None,
    ):
        GroupSerializerBase.__init__(self, collapse=collapse, expand=expand)
        self.environment_func = environment_func if environment_func is not None else lambda: None

    def _seen_stats_error(self, item_list, user) -> Mapping[Group, SeenStats]:
        return self.__seen_stats_impl(
            item_list,
            tagstore.backend.get_groups_user_counts,
            tagstore.backend.get_group_list_tag_value,
        )

    def _seen_stats_generic(
        self, generic_issue_list: Sequence[Group], user
    ) -> Mapping[Group, SeenStats]:
        return self.__seen_stats_impl(
            generic_issue_list,
            tagstore.backend.get_generic_groups_user_counts,
            tagstore.backend.get_generic_group_list_tag_value,
        )

    def __seen_stats_impl(
        self,
        issue_list: Sequence[Group],
        user_counts_func: _GroupUserCountsFunc,
        environment_seen_stats_func: _EnvironmentSeenStatsFunc,
    ) -> Mapping[Group, SeenStats]:
        if not issue_list:
            return {}
        try:
            environment = self.environment_func()
        except Environment.DoesNotExist:
            return {
                item: {"times_seen": 0, "first_seen": None, "last_seen": None, "user_count": 0}
                for item in issue_list
            }

        project_id = issue_list[0].project_id
        item_ids = [g.id for g in issue_list]
        tenant_ids = {"organization_id": issue_list[0].project.organization_id}
        user_counts: Mapping[int, int] = user_counts_func(
            [project_id],
            item_ids,
            environment_ids=[environment.id] if environment is not None else None,
            tenant_ids=tenant_ids,
        )
        first_seen: MutableMapping[int, datetime] = {}
        last_seen: MutableMapping[int, datetime] = {}
        times_seen: MutableMapping[int, int] = {}

        if environment is not None:
            environment_seen_stats = environment_seen_stats_func(
                [project_id],
                item_ids,
                [environment.id],
                "environment",
                environment.name,
                tenant_ids=tenant_ids,
            )
            for item_id, value in environment_seen_stats.items():
                first_seen[item_id] = value.first_seen
                last_seen[item_id] = value.last_seen
                times_seen[item_id] = value.times_seen
        else:
            # fallback to the model data since we can't query tagstore
            for item in issue_list:
                first_seen[item.id] = item.first_seen
                last_seen[item.id] = item.last_seen
                times_seen[item.id] = item.times_seen

        return {
            item: {
                "times_seen": times_seen.get(item.id, 0),
                "first_seen": first_seen.get(item.id),
                "last_seen": last_seen.get(item.id),
                "user_count": user_counts.get(item.id, 0),
            }
            for item in issue_list
        }


class SharedGroupSerializerResponse(TypedDict):
    culprit: str | None
    id: str
    isUnhandled: bool | None
    issueCategory: str
    permalink: str
    shortId: str
    title: str
    latestEvent: dict[str, Any]
    project: dict[str, Any]


class SharedGroupSerializer(GroupSerializer):
    def serialize(  # type: ignore[override]  # return value is a subset
        self,
        obj: Group,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> SharedGroupSerializerResponse:
        result = super().serialize(obj, attrs, user)

        # avoids a circular import
        from sentry.api.serializers.models import SharedEventSerializer, SharedProjectSerializer

        event = obj.get_latest_event()

        return {
            "culprit": result["culprit"],
            "id": result["id"],
            "isUnhandled": result.get("isUnhandled"),
            "issueCategory": result["issueCategory"],
            "permalink": result["permalink"],
            "shortId": result["shortId"],
            "title": result["title"],
            "latestEvent": serialize(event, user, SharedEventSerializer()),
            "project": serialize(obj.project, user, SharedProjectSerializer()),
        }


SKIP_SNUBA_FIELDS = frozenset(
    (
        "status",
        "substatus",
        "bookmarked_by",
        "assigned_to",
        "for_review",
        "assigned_or_suggested",
        "unassigned",
        "linked",
        "subscribed_by",
        "first_release",
        "first_seen",
        "issue.category",
        "issue.priority",
        "issue.type",
    )
)


class GroupSerializerSnuba(GroupSerializerBase):
    skip_snuba_fields = {
        *SKIP_SNUBA_FIELDS,
        "last_seen",
        "times_seen",
        "date",
        "timestamp",  # We merge this with start/end, so don't want to include it as its own
        # condition
        # We don't need to filter by release stage again here since we're
        # filtering to specific groups. Saves us making a second query to
        # postgres for no reason
        RELEASE_STAGE_ALIAS,
    }

    def __init__(
        self,
        environment_ids: list[int] | None = None,
        start: datetime | None = None,
        end: datetime | None = None,
        search_filters=None,
        collapse=None,
        expand=None,
        organization_id=None,
        project_ids=None,
    ):
        super().__init__(collapse=collapse, expand=expand)
        from sentry.search.snuba.executors import get_search_filter

        self.environment_ids = environment_ids
        self.organization_id = organization_id
        # XXX: We copy this logic from `PostgresSnubaQueryExecutor.query`. Ideally we
        # should try and encapsulate this logic, but if you're changing this, change it
        # there as well.
        self.start = None
        start_params = [
            _f
            for _f in [
                start,
                get_search_filter(search_filters, "date", ">"),
                get_search_filter(search_filters, "timestamp", ">"),
            ]
            if _f
        ]
        if start_params:
            self.start = max(_f for _f in start_params if _f)

        self.end = None
        end_params = [
            _f
            for _f in [
                end,
                get_search_filter(search_filters, "date", "<"),
                get_search_filter(search_filters, "timestamp", "<"),
            ]
            if _f
        ]
        if end_params:
            self.end = min(end_params)

        conditions = []
        if search_filters is not None:
            for search_filter in search_filters:
                if search_filter.key.name not in self.skip_snuba_fields:
                    formatted_conditions, projects_to_filter, group_ids = format_search_filter(
                        search_filter,
                        params={
                            "organization_id": organization_id,
                            "project_id": project_ids,
                            "environment_id": environment_ids,
                        },
                    )

                    # if no re-formatted conditions, use fallback method
                    new_condition = None
                    if formatted_conditions:
                        new_condition = formatted_conditions[0]
                    elif group_ids:
                        new_condition = convert_search_filter_to_snuba_query(
                            search_filter,
                            params={
                                "organization_id": organization_id,
                                "project_id": project_ids,
                                "environment_id": environment_ids,
                            },
                        )

                    if new_condition:
                        conditions.append(new_condition)
        self.conditions = conditions

    def _seen_stats_error(
        self, error_issue_list: Sequence[Group], user
    ) -> Mapping[Group, SeenStats]:
        return self._parse_seen_stats_results(
            self._execute_error_seen_stats_query(
                item_list=error_issue_list,
                start=self.start,
                end=self.end,
                conditions=self.conditions,
                environment_ids=self.environment_ids,
            ),
            error_issue_list,
            bool(self.start or self.end or self.conditions),
            self.environment_ids,
        )

    def _seen_stats_generic(
        self, generic_issue_list: Sequence[Group], user
    ) -> Mapping[Group, SeenStats]:
        return self._parse_seen_stats_results(
            self._execute_generic_seen_stats_query(
                item_list=generic_issue_list,
                start=self.start,
                end=self.end,
                conditions=self.conditions,
                environment_ids=self.environment_ids,
            ),
            generic_issue_list,
            bool(self.start or self.end or self.conditions),
            self.environment_ids,
        )

    @staticmethod
    def _execute_error_seen_stats_query(
        item_list, start=None, end=None, conditions=None, environment_ids=None
    ):
        project_ids = list({item.project_id for item in item_list})
        group_ids = [item.id for item in item_list]
        aggregations = [
            ["count()", "", "times_seen"],
            ["min", "timestamp", "first_seen"],
            ["max", "timestamp", "last_seen"],
            ["uniq", "tags[sentry:user]", "count"],
        ]
        filters = {"project_id": project_ids, "group_id": group_ids}
        if environment_ids:
            filters["environment"] = environment_ids

        return aliased_query(
            dataset=Dataset.Events,
            start=start,
            end=end,
            groupby=["group_id"],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            referrer="serializers.GroupSerializerSnuba._execute_error_seen_stats_query",
            tenant_ids=(
                {"organization_id": item_list[0].project.organization_id} if item_list else None
            ),
        )

    @staticmethod
    def _execute_generic_seen_stats_query(
        item_list, start=None, end=None, conditions=None, environment_ids=None
    ):
        project_ids = list({item.project_id for item in item_list})
        group_ids = [item.id for item in item_list]
        aggregations = [
            ["count()", "", "times_seen"],
            ["min", "timestamp", "first_seen"],
            ["max", "timestamp", "last_seen"],
            ["uniq", "tags[sentry:user]", "count"],
        ]
        filters = {"project_id": project_ids, "group_id": group_ids}
        if environment_ids:
            filters["environment"] = environment_ids
        return aliased_query(
            dataset=Dataset.IssuePlatform,
            start=start,
            end=end,
            groupby=["group_id"],
            conditions=conditions,
            filter_keys=filters,
            aggregations=aggregations,
            referrer="serializers.GroupSerializerSnuba._execute_generic_seen_stats_query",
            tenant_ids=(
                {"organization_id": item_list[0].project.organization_id} if item_list else None
            ),
        )

    @staticmethod
    def _parse_seen_stats_results(
        result, item_list, use_result_first_seen_times_seen, environment_ids=None
    ):
        seen_data = {
            issue["group_id"]: fix_tag_value_data(
                dict(filter(lambda key: key[0] != "group_id", issue.items()))
            )
            for issue in result["data"]
        }
        user_counts = {item_id: value["count"] for item_id, value in seen_data.items()}
        last_seen = {item_id: value["last_seen"] for item_id, value in seen_data.items()}
        if use_result_first_seen_times_seen:
            first_seen = {item_id: value["first_seen"] for item_id, value in seen_data.items()}
            times_seen = {item_id: value["times_seen"] for item_id, value in seen_data.items()}
        else:
            if environment_ids:
                first_seen = {
                    ge["group_id"]: ge["first_seen__min"]
                    for ge in GroupEnvironment.objects.filter(
                        group_id__in=[item.id for item in item_list],
                        environment_id__in=environment_ids,
                    )
                    .values("group_id")
                    .annotate(Min("first_seen"))
                }
            else:
                first_seen = {item.id: item.first_seen for item in item_list}
            times_seen = {item.id: item.times_seen for item in item_list}

        return {
            item: {
                "times_seen": times_seen.get(item.id, 0),
                "first_seen": first_seen.get(item.id),
                "last_seen": last_seen.get(item.id),
                "user_count": user_counts.get(item.id, 0),
            }
            for item in item_list
        }
