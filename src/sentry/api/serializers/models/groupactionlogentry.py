import logging
from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING, Annotated, Any, TypedDict

from django.contrib.auth.models import AnonymousUser
from django.db.models import Q

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.activity import (
    ActivitySerializerResponse,
    _ActivitySentryAppEmbed,
    serialize_activity_source,
    serialize_group_notes,
)
from sentry.api.serializers.models.commit import CommitWithReleaseSerializer
from sentry.apidocs.descriptions import ApiDescription
from sentry.auth.access import Access
from sentry.auth.principal import RequestPrincipal
from sentry.issues.action_log.read_metrics import (
    ActivityReadFallbackReason,
    ActivityReadResult,
    record_activity_read,
)
from sentry.issues.action_log.types import (
    ACTION_TYPES_WITH_COMMIT_DATA,
    COMMENT_ACTION_TYPES,
    COMMIT_ACTION_TYPES,
    PULL_REQUEST_ACTION_TYPES,
    CommentAction,
    CommentDeleteAction,
    CommentEditAction,
    FirstSeenAction,
    GroupAction,
    GroupActionType,
    GroupActorType,
    ImpactAssessmentAction,
)
from sentry.issues.derived.gate import should_serve_action_log_activity
from sentry.issues.impact.types import get_impact_level
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.project import Project
from sentry.models.pullrequest import PullRequest
from sentry.notebooks.access import can_view_issue_links
from sentry.notebooks.models import Notebook
from sentry.sentry_apps.api.serializers.sentry_app_avatar import SentryAppAvatarSerializer
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.app.model import RpcSentryApp
from sentry.types.activity import ActivityType
from sentry.types.group import PriorityLevel
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
from sentry.utils.action_log.activity_translator import (
    GROUP_ACTION_TYPE_TO_ACTIVITY_KEYS,
    GROUP_ACTION_TYPE_TO_ACTIVITY_TYPE,
)

if TYPE_CHECKING:
    from sentry.models.group import Group

logger = logging.getLogger(__name__)

# Entries written before SeerPullRequestItem kept pr_number an int store it as a string.
# Reading them through the model turns it back into one.
_SEER_PULL_REQUEST_ACTION_TYPES = {
    GroupActionType.SEER_PR_CREATED.value,
    GroupActionType.SEER_PR_READY_FOR_REVIEW.value,
}

# The stored ID of the other issue in an unmerge, and the key that returns it serialized,
# as ActivitySerializer does.
_UNMERGE_GROUP_KEYS = {
    GroupActionType.UNMERGE_SOURCE.value: ("destination_id", "destination"),
    GroupActionType.UNMERGE_DESTINATION.value: ("source_id", "source"),
}


class GroupActionLogEntrySerializerResponse(ActivitySerializerResponse):
    source: Annotated[
        str | None,
        ApiDescription("Where the action came from, such as web, api or mcp:<client>"),
    ]


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
        "source": serialize_activity_source(entry.source) if entry else None,
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

    Creation events always reference the comment itself (currently an Activity NOTE).
    Historical edit/delete events instead reference the original COMMENT GAL row;
    only explicit comment references can be used with the notes endpoints.
    """
    if obj.type in COMMENT_ACTION_TYPES:
        match obj.action:
            case CommentAction(comment_id=comment_id):
                return str(comment_id)
            case (
                CommentEditAction(comment_id=comment_id, comment_id_kind="comment")
                | CommentDeleteAction(comment_id=comment_id, comment_id_kind="comment")
            ):
                return str(comment_id)
    return None


def get_serialized_activity_items(
    group: "Group",
    user: RequestPrincipal | None,
    *,
    endpoint: str,
    # Without it, investigation links are left out. Slack and Discord actions have none.
    access: Access | None = None,
    limit: int = 99,
    action_filter: Q | None = None,
    include_first_seen: bool = True,
    resolve_mentions: bool = False,
) -> list[dict[str, Any]] | None:
    """
    Merge live Activity comments with non-comment log entries, optionally appending first-seen.

    Each source supplies at most limit candidates. Order by creation time descending,
    comments before actions on ties, and numeric ID descending within each source.
    action_filter narrows visible non-comment actions before applying the limit.

    Returns None when the log can't back the response — either the gate is closed or it's
    open and the log is empty — and the caller should fall back to Activity. Reports the
    read outcome in both cases, so callers don't have to.
    """
    if not should_serve_action_log_activity(group.project, user, endpoint=endpoint):
        return None

    # Investigation links are only shown to viewers who can open the investigation.
    hidden_types: list[GroupActionType] = []
    if access is None or not can_view_issue_links(group.project.organization, user, access):
        hidden_types.append(GroupActionType.INVESTIGATION_LINKED)
    oldest_entry = (
        GroupActionLogEntry.objects.filter(
            group_id=group.id,
            type__in=[*GroupAction.get_user_visible_types(), *COMMENT_ACTION_TYPES],
        )
        .exclude(type__in=hidden_types)
        .order_by("date_added", "id")
        .first()
    )
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
        GroupActionLogEntry.objects.user_visible()
        .filter(group_id=group.id)
        .filter(action_filter if action_filter is not None else Q())
        # Appended separately below, regardless of the limit.
        .exclude(type__in=[GroupActionType.FIRST_SEEN, *hidden_types])
        .order_by("-date_added", "-id")[:limit]
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
        note: dict(item)
        for note, item in zip(
            notes, serialize_group_notes(group, notes, user, resolve_mentions=resolve_mentions)
        )
    }
    serialized.update(zip(entries, serialize(entries, user)))

    record_activity_read(endpoint, ActivityReadResult.GAL)

    serialized_page = [serialized[item] for item in page]
    if not include_first_seen:
        return serialized_page

    first_seen_entry = (
        oldest_entry if oldest_entry.type == GroupActionType.FIRST_SEEN.value else None
    )
    if first_seen_entry is None:
        metrics.incr(
            "issues.action_log.activity_read.first_seen_simulated",
            sample_rate=1.0,
            tags={"endpoint": endpoint},
        )
        logger.info(
            "issues.action_log.activity_read.first_seen_simulated",
            extra={"endpoint": endpoint, "group_id": group.id},
        )

    return serialized_page + [dict(serialize_first_seen_entry(group, first_seen_entry))]


class LinkedInvestigationResponse(TypedDict):
    id: str
    title: str
    status: str


def _investigation_summary(
    notebook: Notebook | None, organization_id: int | None
) -> LinkedInvestigationResponse | None:
    if notebook is None or notebook.organization_id != organization_id:
        return None
    return {"id": str(notebook.id), "title": notebook.title, "status": notebook.status}


def _linked_investigations(
    item_list: Sequence[GroupActionLogEntry],
) -> dict[GroupActionLogEntry, LinkedInvestigationResponse | None]:
    """The investigation each link entry names, or None once it's deleted."""
    links = [item for item in item_list if item.type == GroupActionType.INVESTIGATION_LINKED.value]
    if not links:
        return {}
    organization_ids = dict(
        Project.objects.filter(id__in={item.project_id for item in links}).values_list(
            "id", "organization_id"
        )
    )
    notebooks = Notebook.objects.in_bulk({item.data["notebook_id"] for item in links})
    return {
        item: _investigation_summary(
            notebooks.get(item.data["notebook_id"]), organization_ids.get(item.project_id)
        )
        for item in links
    }


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

        investigations = _linked_investigations(item_list)

        from sentry.api.serializers.models.group import GroupSerializer
        from sentry.models.group import Group

        unmerge_group_ids = {
            item: item.data[_UNMERGE_GROUP_KEYS[item.type][0]]
            for item in item_list
            if item.type in _UNMERGE_GROUP_KEYS and item.data
        }
        group_list = list(Group.objects.filter(id__in=set(unmerge_group_ids.values())))
        groups_by_id = {
            group.id: serialized
            for group, serialized in zip(
                group_list,
                serialize(group_list, user, serializer=GroupSerializer(collapse=["stats"])),
            )
        }

        return {
            item: {
                "investigation": investigations.get(item),
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
                "unmerge_group": groups_by_id.get(unmerge_group_ids.get(item)),
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
            else obj.get_type_display().lower()
        )

        if obj.type == GroupActionType.IMPACT_ASSESSMENT.value:
            action = obj.action
            if not isinstance(action, ImpactAssessmentAction):
                raise TypeError("Impact assessment entry has an unexpected action type")
            data: dict[str, object] = {
                "score": action.score,
                "level": get_impact_level(action.score),
                "description": action.description,
                "citations": [citation.dict() for citation in action.citations],
                "sourceEventId": action.source_event_id,
            }
        elif obj.type == GroupActionType.INVESTIGATION_LINKED.value:
            data = {
                "investigation": attrs["investigation"],
                "hypothesisId": obj.data["hypothesis_id"],
                "hypothesisStatement": obj.data["hypothesis_statement"],
                "reason": obj.data.get("reason"),
            }
        elif (
            obj.type == GroupActionType.SET_RESOLVED_IN_RELEASE.value
            and obj.data
            and obj.data.get("commit")
        ):
            data = {**obj.data, "commit": attrs["commit"]}
        elif obj.type in COMMIT_ACTION_TYPES:
            data = {"commit": attrs["commit"]}
        elif obj.type in PULL_REQUEST_ACTION_TYPES:
            data = {"pullRequest": attrs["pull_request"]}
        elif obj.type in _SEER_PULL_REQUEST_ACTION_TYPES:
            data = obj.action.json_dict()
        elif obj.type in _UNMERGE_GROUP_KEYS:
            data = {
                "fingerprints": (obj.data or {}).get("fingerprints", []),
                _UNMERGE_GROUP_KEYS[obj.type][1]: attrs["unmerge_group"],
            }
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
            "source": serialize_activity_source(obj.source),
            "dateCreated": obj.date_added,
        }
