import logging
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import TYPE_CHECKING, Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.activity import _ActivitySentryAppEmbed, serialize_group_notes
from sentry.api.serializers.models.commit import CommitWithReleaseSerializer
from sentry.issues.action_log.read_metrics import (
    ActivityReadFallbackReason,
    ActivityReadResult,
    record_activity_read,
)
from sentry.issues.action_log.types import (
    ACTION_TYPES_WITH_COMMIT_DATA,
    COMMENT_MUTATION_ACTION_TYPES,
    COMMIT_ACTION_TYPES,
    PULL_REQUEST_ACTION_TYPES,
    ActionSource,
    CommentAction,
    FirstSeenAction,
    GroupActionType,
    GroupActorType,
)
from sentry.issues.derived.gate import should_serve_action_log_activity
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.pullrequest import PullRequest
from sentry.sentry_apps.api.serializers.sentry_app_avatar import SentryAppAvatarSerializer
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.app.model import RpcSentryApp
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service
from sentry.utils.action_log.activity_translator import (
    GROUP_ACTION_TYPE_TO_ACTIVITY_KEYS,
    GROUP_ACTION_TYPE_TO_ACTIVITY_TYPE,
)
from sentry.utils.http import LEGACY_MCP_CLIENT_FAMILY_ALIASES

if TYPE_CHECKING:
    from sentry.models.group import Group

logger = logging.getLogger(__name__)


class GroupActionLogEntrySerializerResponse(TypedDict):
    id: str
    # The reference accepted by the notes endpoints, or null for non-comments.
    commentId: str | None
    # the serialized acting user when actorType is USER, otherwise null
    user: dict[str, Any] | None
    sentry_app: _ActivitySentryAppEmbed | None
    type: str
    source: str | None
    data: dict[str, Any]
    dateCreated: datetime


def _serialized_source(source: str) -> str:
    """
    The source as clients should see it.

    Action log rows are never migrated, so rows written with a since-renamed MCP client
    family (e.g. ``mcp:claude-desktop``) are translated to the current name here.
    """
    prefix, sep, family = source.partition(":")
    if sep and prefix == ActionSource.MCP and family in LEGACY_MCP_CLIENT_FAMILY_ALIASES:
        return f"{prefix}:{LEGACY_MCP_CLIENT_FAMILY_ALIASES[family]}"
    return source


def serialize_first_seen_entry(
    group: "Group", entry: GroupActionLogEntry | None = None
) -> GroupActionLogEntrySerializerResponse:
    """
    The first-seen item, in the shape ActivityManager.get_activities_for_group synthesizes.

    Groups created before FIRST_SEEN was logged have no *entry*, so one is synthesized
    from the group.
    """
    initial_priority_value = group.get_event_metadata().get("initial_priority")
    initial_priority = (
        PriorityLevel(initial_priority_value).to_str() if initial_priority_value else None
    )
    return {
        "id": str(entry.id) if entry else "0",
        "commentId": None,
        "user": None,
        "sentry_app": None,
        "type": ActivityType.FIRST_SEEN.name.lower(),
        "source": _serialized_source(entry.source) if entry else None,
        "data": {"priority": initial_priority},
        "dateCreated": (
            entry.action.first_seen
            if entry and isinstance(entry.action, FirstSeenAction)
            else group.first_seen
        ),
    }


def _serialized_comment_id(obj: GroupActionLogEntry) -> str | None:
    """
    The comment reference accepted by the notes endpoints.

    The notes endpoints resolve ``note_id`` against ``Activity.id``, so a COMMENT
    references its ``comment_id`` (the Activity it mirrors).
    COMMENT_EDIT and COMMENT_DELETE carry a ``comment_id`` too, but theirs points
    at the GALE id of the COMMENT they supersede, not an addressable comment.
    """
    if obj.type == GroupActionType.COMMENT.value:
        match obj.action:
            case CommentAction(comment_id=comment_id):
                return str(comment_id)
    return None


def get_serialized_activity_items(
    group: "Group",
    user: User | RpcUser | AnonymousUser | None,
    *,
    endpoint: str,
    limit: int = 99,
) -> list[dict[str, Any]] | None:
    """
    Merge live Activity comments with non-comment log entries, then append one first-seen.

    Each source supplies at most limit candidates. Order by creation time descending,
    comments before actions on ties, and numeric ID descending within each source.

    Returns None when the log can't back the response — either the gate is closed or it's
    open and the log is empty — and the caller should fall back to Activity. Reports the
    read outcome in both cases, so callers don't have to.
    """
    if not should_serve_action_log_activity(group.project, user, endpoint=endpoint):
        return None

    action_log = GroupActionLogEntry.objects.user_visible().filter(group_id=group.id)
    # Inspect the whole visible log, not just non-comment entries: a comment-only
    # log is valid. This also identifies the original first-seen after merges.
    oldest_entry = action_log.order_by("date_added", "id").first()
    if oldest_entry is None:
        record_activity_read(
            endpoint, ActivityReadResult.FELL_BACK, ActivityReadFallbackReason.EMPTY_LOG
        )
        logger.info(
            "issues.action_log.activity_read.not_found",
            extra={"endpoint": endpoint, "group_id": group.id},
        )
        return None

    entries = list(
        action_log.exclude(
            type__in=[
                GroupActionType.COMMENT.value,
                *COMMENT_MUTATION_ACTION_TYPES,
                GroupActionType.FIRST_SEEN.value,
            ]
        ).order_by("-date_added", "-id")[:limit]
    )
    notes = list(
        Activity.objects.filter(group=group, type=ActivityType.NOTE.value).order_by(
            "-datetime", "-id"
        )[:limit]
    )
    candidates: list[Activity | GroupActionLogEntry] = [*notes, *entries]
    page = sorted(
        candidates,
        key=lambda item: (
            item.datetime if isinstance(item, Activity) else item.date_added,
            isinstance(item, Activity),
            item.id,
        ),
        reverse=True,
    )[:limit]

    # Serialize only the selected rows, batching each model's related-data lookups.
    notes = [item for item in page if isinstance(item, Activity)]
    entries = [item for item in page if isinstance(item, GroupActionLogEntry)]
    serialized: dict[Activity | GroupActionLogEntry, dict[str, Any]] = {
        note: dict(item) for note, item in zip(notes, serialize_group_notes(group, notes, user))
    }
    serialized.update(zip(entries, serialize(entries, user)))

    first_seen_entry = (
        oldest_entry if oldest_entry.type == GroupActionType.FIRST_SEEN.value else None
    )

    record_activity_read(endpoint, ActivityReadResult.GAL)
    return [serialized[item] for item in page] + [
        dict(serialize_first_seen_entry(group, first_seen_entry))
    ]


@register(GroupActionLogEntry)
class GroupActionLogEntrySerializer(Serializer):
    def get_attrs(
        self,
        item_list: Sequence[GroupActionLogEntry],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> dict[GroupActionLogEntry, Any]:
        user_ids = [
            i.actor_id for i in item_list if i.actor_id and i.actor_type == GroupActorType.USER
        ]
        users = {}
        if user_ids:
            user_list = user_service.serialize_many(
                filter={"user_ids": user_ids}, as_user=serialize_generic_user(user)
            )
            users = {u["id"]: u for u in user_list}

        # add sentry app data

        # If an entry is created by a Sentry App, attach it to the payload. For
        # SENTRY_APP entries, actor_id is the SentryApp id (not its proxy user id).
        sentry_app_ids = [
            i.actor_id
            for i in item_list
            if i.actor_id and i.actor_type == GroupActorType.SENTRY_APP
        ]
        sentry_apps_list: list[RpcSentryApp] = []
        if sentry_app_ids:
            sentry_apps_list = app_service.get_sentry_apps_by_ids(ids=sentry_app_ids)
        # Minimal Sentry App serialization to keep the payload minimal
        all_avatars = [avatar for app in sentry_apps_list for avatar in app.avatars]
        serialized_avatars = serialize(all_avatars, user, serializer=SentryAppAvatarSerializer())
        sentry_apps: dict[str, _ActivitySentryAppEmbed] = {}
        avatar_offset = 0
        for app in sentry_apps_list:
            avatar_count = len(app.avatars)
            sentry_apps[str(app.id)] = {
                "id": str(app.id),
                "name": app.name,
                "slug": app.slug,
                "avatars": serialized_avatars[avatar_offset : avatar_offset + avatar_count],
            }
            avatar_offset += avatar_count

        # add commit data
        commit_ids = {
            i.data["commit"]
            for i in item_list
            if i.type in ACTION_TYPES_WITH_COMMIT_DATA and i.data and i.data.get("commit")
        }
        if commit_ids:
            commit_list = list(Commit.objects.filter(id__in=commit_ids))
            commits_by_id = {
                c.id: d
                for c, d in zip(
                    commit_list,
                    serialize(commit_list, user, serializer=CommitWithReleaseSerializer()),
                )
            }
            commits = {
                i: commits_by_id.get(i.data["commit"])
                for i in item_list
                if i.type in ACTION_TYPES_WITH_COMMIT_DATA and i.data and i.data.get("commit")
            }
        else:
            commits = {}

        # add pull request data
        pull_request_ids = {
            i.data["pull_request"]
            for i in item_list
            if i.type in PULL_REQUEST_ACTION_TYPES and i.data and i.data.get("pull_request")
        }
        if pull_request_ids:
            pull_request_list = list(PullRequest.objects.filter(id__in=pull_request_ids))
            pull_requests_by_id = {
                c.id: d for c, d in zip(pull_request_list, serialize(pull_request_list, user))
            }
            pull_requests = {
                i: pull_requests_by_id.get(i.data["pull_request"])
                for i in item_list
                if i.type in PULL_REQUEST_ACTION_TYPES and i.data and i.data.get("pull_request")
            }
        else:
            pull_requests = {}

        return {
            item: {
                "user": (
                    users.get(str(item.actor_id))
                    if item.actor_type == GroupActorType.USER
                    else None
                ),
                "sentry_app": (
                    sentry_apps.get(str(item.actor_id))
                    if item.actor_type == GroupActorType.SENTRY_APP
                    else None
                ),
                "commit": commits.get(item),
                "pull_request": pull_requests.get(item),
            }
            for item in item_list
        }

    def serialize(
        self,
        obj: GroupActionLogEntry,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> GroupActionLogEntrySerializerResponse:
        activity_type = GROUP_ACTION_TYPE_TO_ACTIVITY_TYPE.get(obj.type)
        type_display = (
            ActivityType(activity_type).name.lower()
            if activity_type is not None
            else obj.get_type_display()
        )

        if (
            obj.type == GroupActionType.SET_RESOLVED_IN_RELEASE.value
            and obj.data
            and obj.data.get("commit")
        ):
            data = {**obj.data, "commit": attrs["commit"]}
        elif obj.type in COMMIT_ACTION_TYPES:
            data = {"commit": attrs["commit"]}
        elif obj.type in PULL_REQUEST_ACTION_TYPES:
            data = {"pullRequest": attrs["pull_request"]}
        elif obj.type == GroupActionType.MERGE_FROM_OTHER.value:
            # Activity stores merged issues as a list of objects; GALE stores only ids.
            counterpart_group_ids = (obj.data or {}).get("counterpart_group_ids", [])
            data = {"issues": [{"id": str(group_id)} for group_id in counterpart_group_ids]}
        else:
            raw_data = obj.data or {}
            key_translations = GROUP_ACTION_TYPE_TO_ACTIVITY_KEYS.get(obj.type)
            if key_translations:
                data = {key_translations.get(key, key): value for key, value in raw_data.items()}
            else:
                data = dict(raw_data)
            data.pop("mentions", None)

        if (
            obj.type == GroupActionType.SET_RESOLVED_IN_RELEASE.value
            and data.get("current_release_version") is None
        ):
            data.pop("current_release_version", None)

        return {
            "id": str(obj.id),
            "commentId": _serialized_comment_id(obj),
            "type": type_display,
            "user": attrs["user"],
            "sentry_app": attrs["sentry_app"],
            "data": data,
            "source": _serialized_source(obj.source),
            "dateCreated": obj.date_added,
        }
