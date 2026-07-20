from datetime import datetime
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.activity import _ActivitySentryAppEmbed
from sentry.api.serializers.models.commit import CommitWithReleaseSerializer
from sentry.issues.action_log.types import GroupActionType, GroupActorType
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.models.commit import Commit
from sentry.models.pullrequest import PullRequest
from sentry.sentry_apps.api.serializers.sentry_app_avatar import SentryAppAvatarSerializer
from sentry.sentry_apps.services.app import app_service
from sentry.sentry_apps.services.app.model import RpcSentryApp
from sentry.types.activity import ActivityType
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service
from sentry.utils.action_log.activity_translator import ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE

# Mirror GroupActionTypes are serialized with the same `type` string as their
# equivalent Activity so the frontend can consume both identically.
_GROUP_ACTION_TYPE_TO_ACTIVITY_TYPE = {
    action_cls.get_type().value: activity_type
    for activity_type, action_cls in ACTIVITY_TYPE_TO_GROUP_ACTION_TYPE.items()
}

COMMIT_ACTION_TYPES = {
    GroupActionType.SET_RESOLVED_IN_COMMIT.value,
    GroupActionType.REFERENCED_IN_COMMIT.value,
}

ACTION_TYPES_WITH_COMMIT_DATA = {
    *COMMIT_ACTION_TYPES,
    GroupActionType.SET_RESOLVED_IN_RELEASE.value,
}

PULL_REQUEST_ACTION_TYPES = {
    GroupActionType.RESOLVED_IN_PULL_REQUEST.value,
    GroupActionType.PULL_REQUEST_CLOSED.value,
    GroupActionType.PULL_REQUEST_REOPENED.value,
    GroupActionType.PULL_REQUEST_MERGED.value,
    GroupActionType.PULL_REQUEST_UNLINKED.value,
}


class GroupActionLogEntrySerializerResponse(TypedDict):
    id: str
    # The serialized acting user when actorType is USER, otherwise null.
    user: dict[str, Any] | None
    sentry_app: _ActivitySentryAppEmbed | None
    type: str
    data: dict[str, Any]
    dateCreated: datetime


@register(GroupActionLogEntry)
class GroupActionLogEntrySerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
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

        # If an entry is created by the proxy user of a Sentry App, attach it to the payload
        sentry_apps_list: list[RpcSentryApp] = []
        if user_ids:
            sentry_apps_list = app_service.get_sentry_apps_by_proxy_users(proxy_user_ids=user_ids)
        # Minimal Sentry App serialization to keep the payload minimal
        sentry_apps: dict[str, _ActivitySentryAppEmbed] = {
            str(app.proxy_user_id): {
                "id": str(app.id),
                "name": app.name,
                "slug": app.slug,
                "avatars": serialize(app.avatars, user, serializer=SentryAppAvatarSerializer()),
            }
            for app in sentry_apps_list
            if app.proxy_user_id
        }

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
                "sentry_app": sentry_apps.get(str(item.actor_id)) if item.actor_id else None,
                "commit": commits.get(item),
                "pull_request": pull_requests.get(item),
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user, **kwargs) -> GroupActionLogEntrySerializerResponse:
        activity_type = _GROUP_ACTION_TYPE_TO_ACTIVITY_TYPE.get(obj.type)
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
        else:
            data = obj.data or {}

        return {
            "id": str(obj.id),
            "type": type_display,
            "user": attrs["user"],
            "sentry_app": attrs["sentry_app"],
            "data": data,
            "dateCreated": obj.date_added,
        }
