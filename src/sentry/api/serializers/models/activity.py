from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.commit import CommitWithReleaseSerializer
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.group import Group
from sentry.models.pullrequest import PullRequest
from sentry.types.activity import ActivityType
from sentry.users.services.user.serial import serialize_generic_user
from sentry.users.services.user.service import user_service


@register(Activity)
class ActivitySerializer(Serializer):
    def __init__(self, environment_func=None):
        self.environment_func = environment_func

    def get_attrs(self, item_list, user, **kwargs):
        from sentry.api.serializers.models.group import GroupSerializer

        # TODO(dcramer); assert on relations
        user_ids = [i.user_id for i in item_list if i.user_id]
        user_list = []
        if user_ids:
            user_list = user_service.serialize_many(
                filter={"user_ids": user_ids}, as_user=serialize_generic_user(user)
            )
        users = {u["id"]: u for u in user_list}

        commit_ids = {
            i.data["commit"]
            for i in item_list
            if i.type == ActivityType.SET_RESOLVED_IN_COMMIT.value
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
                if i.type == ActivityType.SET_RESOLVED_IN_COMMIT.value
            }
        else:
            commits = {}

        pull_request_ids = {
            i.data["pull_request"]
            for i in item_list
            if i.type == ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value
        }
        if pull_request_ids:
            pull_request_list = list(PullRequest.objects.filter(id__in=pull_request_ids))
            pull_requests_by_id = {
                c.id: d for c, d in zip(pull_request_list, serialize(pull_request_list, user))
            }
            pull_requests = {
                i: pull_requests_by_id.get(i.data["pull_request"])
                for i in item_list
                if i.type == ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value
            }
        else:
            pull_requests = {}

        groups = {
            k: serialize(v, user=user, serializer=GroupSerializer(collapse=["stats"]))
            for k, v in Group.objects.in_bulk(
                {
                    i.data["source_id"]
                    for i in item_list
                    if i.type == ActivityType.UNMERGE_DESTINATION.value
                }
                | {
                    i.data["destination_id"]
                    for i in item_list
                    if i.type == ActivityType.UNMERGE_SOURCE.value
                }
            ).items()
        }

        return {
            item: {
                "user": users.get(str(item.user_id)) if item.user_id else None,
                "source": (
                    groups.get(item.data["source_id"])
                    if item.type == ActivityType.UNMERGE_DESTINATION.value
                    else None
                ),
                "destination": (
                    groups.get(item.data["destination_id"])
                    if item.type == ActivityType.UNMERGE_SOURCE.value
                    else None
                ),
                "commit": commits.get(item),
                "pull_request": pull_requests.get(item),
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user, **kwargs):
        if obj.type == ActivityType.SET_RESOLVED_IN_COMMIT.value:
            data = {"commit": attrs["commit"]}
        elif obj.type == ActivityType.SET_RESOLVED_IN_PULL_REQUEST.value:
            data = {"pullRequest": attrs["pull_request"]}
        elif obj.type == ActivityType.UNMERGE_DESTINATION.value:
            data = {"fingerprints": obj.data["fingerprints"], "source": attrs["source"]}
        elif obj.type == ActivityType.UNMERGE_SOURCE.value:
            data = {"fingerprints": obj.data["fingerprints"], "destination": attrs["destination"]}
        else:
            data = obj.data
            # XXX: We had a problem where Users were embedded into the mentions
            # attribute of group notes which needs to be removed
            # While group_note update has been fixed there are still many skunky comments
            # in the database.
            data.pop("mentions", None)

        return {
            "id": str(obj.id),
            "user": attrs["user"],
            "type": obj.get_type_display(),
            "data": data,
            "dateCreated": obj.datetime,
        }
