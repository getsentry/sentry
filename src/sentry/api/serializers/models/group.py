from __future__ import annotations

import itertools
import logging
from abc import ABC, abstractmethod
from collections import defaultdict
from datetime import datetime, timedelta
from typing import (
    Any,
    Callable,
    Iterable,
    List,
    Mapping,
    MutableMapping,
    Optional,
    Protocol,
    Sequence,
    Set,
    Tuple,
    TypedDict,
    Union,
)

import pytz
import sentry_sdk
from django.conf import settings
from django.db.models import Min, prefetch_related_objects

from sentry import analytics, tagstore
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.actor import ActorSerializer
from sentry.api.serializers.models.plugin import is_plugin_deprecated
from sentry.api.serializers.models.user import UserSerializerResponse
from sentry.app import env
from sentry.auth.superuser import is_active_superuser
from sentry.constants import LOG_LEVELS
from sentry.issues.grouptype import GroupCategory
from sentry.models import (
    Commit,
    Environment,
    Group,
    GroupAssignee,
    GroupBookmark,
    GroupEnvironment,
    GroupLink,
    GroupMeta,
    GroupResolution,
    GroupSeen,
    GroupShare,
    GroupSnooze,
    GroupStatus,
    GroupSubscription,
    Team,
    User,
)
from sentry.models.apitoken import is_api_token_auth
from sentry.models.organizationmember import OrganizationMember
from sentry.notifications.helpers import (
    collect_groups_by_project,
    get_groups_for_query,
    get_subscription_from_attributes,
    get_user_subscriptions_for_groups,
    transform_to_notification_settings_by_scope,
)
from sentry.notifications.types import NotificationSettingTypes
from sentry.reprocessing2 import get_progress
from sentry.search.events.constants import RELEASE_STAGE_ALIAS
from sentry.search.events.filter import convert_search_filter_to_snuba_query, format_search_filter
from sentry.services.hybrid_cloud.auth import AuthenticatedToken, auth_service
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.notifications import notifications_service
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.tagstore.snuba.backend import fix_tag_value_data
from sentry.tagstore.types import GroupTagValue
from sentry.tsdb.snuba import SnubaTSDB
from sentry.types.group import SUBSTATUS_TO_STR
from sentry.utils.cache import cache
from sentry.utils.json import JSONData
from sentry.utils.safe import safe_execute
from sentry.utils.snuba import Dataset, aliased_query, raw_query

# TODO(jess): remove when snuba is primary backend
snuba_tsdb = SnubaTSDB(**settings.SENTRY_TSDB_OPTIONS)


logger = logging.getLogger(__name__)


def merge_list_dictionaries(
    dict1: MutableMapping[Any, List[Any]], dict2: Mapping[Any, Sequence[Any]]
):
    for key, val in dict2.items():
        dict1.setdefault(key, []).extend(val)


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
    info: JSONData


class GroupStatusDetailsResponse(GroupStatusDetailsResponseOptional):
    pass


class GroupProjectResponse(TypedDict):
    id: str
    name: str
    slug: str
    platform: str


class GroupMetadataResponseOptional(TypedDict, total=False):
    type: str
    filename: str
    function: str


class GroupMetadataResponse(GroupMetadataResponseOptional):
    value: str
    display_title_with_tree_label: bool


class GroupSubscriptionResponseOptional(TypedDict, total=False):
    disabled: bool
    reason: str


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
    culprit: str
    permalink: str
    logger: Optional[str]
    level: str
    status: str
    statusDetails: GroupStatusDetailsResponseOptional
    isPublic: bool
    platform: str
    project: GroupProjectResponse
    type: str
    metadata: GroupMetadataResponse
    numComments: int
    assignedTo: UserSerializerResponse
    isBookmarked: bool
    isSubscribed: bool
    subscriptionDetails: Optional[GroupSubscriptionResponseOptional]
    hasSeen: bool
    annotations: Sequence[str]


class SeenStats(TypedDict):
    times_seen: int
    first_seen: datetime
    last_seen: datetime
    user_count: int


class GroupSerializerBase(Serializer, ABC):
    def __init__(
        self,
        collapse=None,
        expand=None,
    ):
        self.collapse = collapse
        self.expand = expand

    def _serialize_assignees(self, item_list: Sequence[Group]) -> Mapping[int, Union[Team, Any]]:
        gas = GroupAssignee.objects.filter(group__in=item_list)
        result: MutableMapping[int, Union[Team, Any]] = {}
        all_team_ids: MutableMapping[int, Set[int]] = defaultdict(set)
        all_user_ids: MutableMapping[int, Set[int]] = defaultdict(set)

        for g in gas:
            if g.team_id:
                all_team_ids[g.team_id].add(g.group_id)
            if g.user_id:
                all_user_ids[g.user_id].add(g.group_id)

        for team in Team.objects.filter(id__in=all_team_ids.keys()):
            for group_id in all_team_ids[team.id]:
                result[group_id] = team
        for user in user_service.get_many(filter=dict(user_ids=list(all_user_ids.keys()))):
            for group_id in all_user_ids[user.id]:
                result[group_id] = user

        return result

    def get_attrs(
        self, item_list: Sequence[Group], user: Any, **kwargs: Any
    ) -> MutableMapping[Group, MutableMapping[str, Any]]:
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

        user_ids = {r[-1] for r in release_resolutions.values()}
        user_ids.update(r.actor_id for r in ignore_items.values())
        if user_ids:
            serialized_users = user_service.serialize_many(
                filter={"user_ids": user_ids, "is_active": True},
                as_user=user,
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
                "Found multiple organizations for groups: %s, with orgs: %s"
                % ([item.id for item in item_list], organization_id_list)
            )

        # should only have 1 org at this point
        organization_id = organization_id_list[0]

        authorized = self._is_authorized(user, organization_id)

        annotations_by_group_id: MutableMapping[int, List[Any]] = defaultdict(list)
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

            result[item]["is_unhandled"] = bool(snuba_stats.get(item.id, {}).get("unhandled"))

            if seen_stats:
                result[item].update(seen_stats.get(item, {}))
        return result

    def serialize(
        self, obj: Group, attrs: MutableMapping[str, Any], user: Any, **kwargs: Any
    ) -> BaseGroupSerializerResponse:
        status_details, status_label = self._get_status(attrs, obj)
        permalink = self._get_permalink(attrs, obj)
        is_subscribed, subscription_details = get_subscription_from_attributes(attrs)
        share_id = attrs["share_id"]
        group_dict = {
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
        }

        # This attribute is currently feature gated
        if "is_unhandled" in attrs:
            group_dict["isUnhandled"] = attrs["is_unhandled"]
        if "times_seen" in attrs:
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

    def _get_status(self, attrs: MutableMapping[str, Any], obj: Group):
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
            status = GroupStatus.RESOLVED
            status_details["autoResolved"] = True
            analytics.record(
                "issue.resolved",
                default_user_id=obj.project.organization.get_default_owner().id,
                project_id=obj.project.id,
                organization_id=obj.project.organization_id,
                group_id=obj.id,
                resolution_type="automatic",
                issue_type=obj.issue_type.slug,
                issue_category=obj.issue_category.name.lower(),
            )
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
            status_details["pendingEvents"], status_details["info"] = get_progress(attrs["id"])
        else:
            status_label = "unresolved"
        return status_details, status_label

    def _get_seen_stats(
        self, item_list: Sequence[Group], user
    ) -> Optional[Mapping[Group, SeenStats]]:
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
            return

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
        return {group: agg_stats.get(group, {}) for group in item_list}

    def _get_group_snuba_stats(
        self, item_list: Sequence[Group], seen_stats: Optional[Mapping[Group, SeenStats]]
    ):
        start = self._get_start_from_seen_stats(seen_stats)
        unhandled = {}

        cache_keys = []
        for item in item_list:
            cache_keys.append(f"group-mechanism-handled:{item.id}")

        cache_data = cache.get_many(cache_keys)
        for item, cache_key in zip(item_list, cache_keys):
            unhandled[item.id] = cache_data.get(cache_key)

        filter_keys = {}
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
                tenant_ids={"organization_id": item_list[0].project.organization_id}
                if item_list
                else None,
            )
            for x in rv["data"]:
                unhandled[x["group_id"]] = x["unhandled"]

                # cache the handled flag for 60 seconds.  This is broadly in line with
                # the time we give for buffer flushes so the user experience is somewhat
                # consistent here.
                cache.set("group-mechanism-handled:%d" % x["group_id"], x["unhandled"], 60)

        return {group_id: {"unhandled": unhandled} for group_id, unhandled in unhandled.items()}

    @staticmethod
    def _get_start_from_seen_stats(seen_stats: Optional[Mapping[Group, SeenStats]]):
        # Try to figure out what is a reasonable time frame to look into stats,
        # based on a given "seen stats".  We try to pick a day prior to the earliest last seen,
        # but it has to be at least 14 days, and not more than 90 days ago.
        # Fallback to the 30 days ago if we are not able to calculate the value.
        last_seen = None
        if seen_stats:
            for item in seen_stats.values():
                if last_seen is None or (item["last_seen"] and last_seen > item["last_seen"]):
                    last_seen = item["last_seen"]

        if last_seen is None:
            return datetime.now(pytz.utc) - timedelta(days=30)

        return max(
            min(last_seen - timedelta(days=1), datetime.now(pytz.utc) - timedelta(days=14)),
            datetime.now(pytz.utc) - timedelta(days=90),
        )

    @staticmethod
    def _get_subscriptions(
        groups: Iterable[Group], user: User
    ) -> Mapping[int, Tuple[bool, bool, Optional[GroupSubscription]]]:
        """
        Returns a mapping of group IDs to a two-tuple of (is_disabled: bool,
        subscribed: bool, subscription: Optional[GroupSubscription]) for the
        provided user and groups.
        """
        if not groups:
            return {}

        groups_by_project = collect_groups_by_project(groups)
        notification_settings_by_scope = transform_to_notification_settings_by_scope(
            notifications_service.get_settings_for_user_by_projects(
                type=NotificationSettingTypes.WORKFLOW,
                user_id=user.id,
                parent_ids=list(groups_by_project.keys()),
            )
        )
        query_groups = get_groups_for_query(groups_by_project, notification_settings_by_scope, user)
        subscriptions = GroupSubscription.objects.filter(group__in=query_groups, user_id=user.id)
        subscriptions_by_group_id = {
            subscription.group_id: subscription for subscription in subscriptions
        }

        return get_user_subscriptions_for_groups(
            groups_by_project,
            notification_settings_by_scope,
            subscriptions_by_group_id,
            user,
        )

    @staticmethod
    def _resolve_resolutions(
        groups: Sequence[Group], user
    ) -> Tuple[Mapping[int, Sequence[Any]], Mapping[int, Any]]:
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
            i.group_id: d for i, d in zip(commit_results, serialize(commit_results, user))
        }

        return _release_resolutions, _commit_resolutions

    @staticmethod
    def _resolve_external_issue_annotations(groups: Sequence[Group]) -> Mapping[int, Sequence[Any]]:
        from sentry.models import PlatformExternalIssue

        # find the external issues for sentry apps and add them in
        return (
            safe_execute(
                PlatformExternalIssue.get_annotations_for_group_list,
                group_list=groups,
                _with_transaction=False,
            )
            or {}
        )

    @staticmethod
    def _resolve_integration_annotations(
        org_id: int, groups: Sequence[Group]
    ) -> Sequence[Mapping[int, Sequence[Any]]]:
        from sentry.integrations import IntegrationFeatures

        integration_annotations = []
        # find all the integration installs that have issue tracking
        integrations = integration_service.get_integrations(organization_id=org_id)
        for integration in integrations:
            if not (
                integration_service.has_feature(
                    provider=integration.provider, feature=IntegrationFeatures.ISSUE_BASIC
                )
                or integration_service.has_feature(
                    provider=integration.provider, feature=IntegrationFeatures.ISSUE_SYNC
                )
            ):
                continue

            install = integration_service.get_installation(
                integration=integration, organization_id=org_id
            )
            local_annotations_by_group_id = (
                safe_execute(
                    install.get_annotations_for_group_list,
                    group_list=groups,
                    _with_transaction=False,
                )
                or {}
            )
            integration_annotations.append(local_annotations_by_group_id)

        return integration_annotations

    @staticmethod
    def _resolve_and_extend_plugin_annotation(
        item: Group, current_annotations: List[Any]
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
            safe_execute(plugin.tags, None, item, annotations_for_group, _with_transaction=False)
        for plugin in plugins.for_project(project=item.project, version=2):
            annotations_for_group.extend(
                safe_execute(plugin.get_annotations, group=item, _with_transaction=False) or ()
            )

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
            request
            and getattr(request.user, "is_sentry_app", False)
            and is_api_token_auth(request.auth)
        ):

            if auth_service.token_has_org_access(
                token=AuthenticatedToken.from_token(request.auth), organization_id=organization_id
            ):
                return True

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


@register(Group)
class GroupSerializer(GroupSerializerBase):
    class GroupUserCountsFunc(Protocol):
        def __call__(
            self,
            project_ids: Sequence[int],
            item_ids: Sequence[int],
            environment_ids: Optional[Sequence[int]],
        ) -> Mapping[int, int]:
            pass

    def __init__(self, environment_func: Callable[[], Environment] = None):
        GroupSerializerBase.__init__(self)
        self.environment_func = environment_func if environment_func is not None else lambda: None

    def _seen_stats_error(self, item_list, user) -> Mapping[Group, SeenStats]:
        return self.__seen_stats_impl(
            item_list, tagstore.get_groups_user_counts, tagstore.get_group_list_tag_value
        )

    def _seen_stats_generic(
        self, generic_issue_list: Sequence[Group], user
    ) -> Mapping[Group, SeenStats]:
        return self.__seen_stats_impl(
            generic_issue_list,
            tagstore.get_generic_groups_user_counts,
            tagstore.get_generic_group_list_tag_value,
        )

    def __seen_stats_impl(
        self,
        issue_list: Sequence[Group],
        user_counts_func: GroupUserCountsFunc,
        environment_seen_stats_func: Callable[
            [Sequence[int], Sequence[int], Sequence[int], str, str], Mapping[int, GroupTagValue]
        ],
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
            environment_ids=environment and [environment.id],
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


class SharedGroupSerializer(GroupSerializer):
    def serialize(
        self, obj: Group, attrs: MutableMapping[str, Any], user: Any, **kwargs: Any
    ) -> BaseGroupSerializerResponse:
        result = super().serialize(obj, attrs, user)
        del result["annotations"]  # type:ignore
        return result


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
        environment_ids=None,
        start=None,
        end=None,
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
            tenant_ids={"organization_id": item_list[0].project.organization_id}
            if item_list
            else None,
        )

    @staticmethod
    def _execute_perf_seen_stats_query(
        item_list, start=None, end=None, conditions=None, environment_ids=None
    ):
        project_ids = list({item.project_id for item in item_list})
        group_ids = [item.id for item in item_list]
        aggregations = [
            ["arrayJoin", ["group_ids"], "group_id"],
            ["count()", "", "times_seen"],
            ["min", "timestamp", "first_seen"],
            ["max", "timestamp", "last_seen"],
            ["uniq", "tags[sentry:user]", "count"],
        ]
        filters = {"project_id": project_ids}
        if environment_ids:
            filters["environment"] = environment_ids
        return aliased_query(
            dataset=Dataset.Transactions,
            start=start,
            end=end,
            groupby=["group_id"],
            conditions=[
                [["hasAny", ["group_ids", ["array", group_ids]]], "=", 1],
            ]
            + (conditions or []),
            filter_keys=filters,
            aggregations=aggregations,
            referrer="serializers.GroupSerializerSnuba._execute_perf_seen_stats_query",
            tenant_ids={"organization_id": item_list[0].project.organization_id}
            if item_list
            else None,
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
            tenant_ids={"organization_id": item_list[0].project.organization_id}
            if item_list
            else None,
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
