import functools

from sentry.api.serializers import Serializer, register, serialize
from sentry.models import Activity, Commit, Group, PullRequest
from sentry.utils.compat import zip
from sentry.utils.functional import apply_values


@register(Activity)
class ActivitySerializer(Serializer):
    def __init__(self, environment_func=None):
        self.environment_func = environment_func

    def get_attrs(self, item_list, user):
        # TODO(dcramer); assert on relations
        users = {d["id"]: d for d in serialize({i.user for i in item_list if i.user_id}, user)}

        commit_ids = {
            i.data["commit"] for i in item_list if i.type == Activity.SET_RESOLVED_IN_COMMIT
        }
        if commit_ids:
            commit_list = list(Commit.objects.filter(id__in=commit_ids))
            commits_by_id = {c.id: d for c, d in zip(commit_list, serialize(commit_list, user))}
            commits = {
                i: commits_by_id.get(i.data["commit"])
                for i in item_list
                if i.type == Activity.SET_RESOLVED_IN_COMMIT
            }
        else:
            commits = {}

        pull_request_ids = {
            i.data["pull_request"]
            for i in item_list
            if i.type == Activity.SET_RESOLVED_IN_PULL_REQUEST
        }
        if pull_request_ids:
            pull_request_list = list(PullRequest.objects.filter(id__in=pull_request_ids))
            pull_requests_by_id = {
                c.id: d for c, d in zip(pull_request_list, serialize(pull_request_list, user))
            }
            pull_requests = {
                i: pull_requests_by_id.get(i.data["pull_request"])
                for i in item_list
                if i.type == Activity.SET_RESOLVED_IN_PULL_REQUEST
            }
        else:
            pull_requests = {}

        groups = apply_values(
            functools.partial(serialize, user=user),
            Group.objects.in_bulk(
                {i.data["source_id"] for i in item_list if i.type == Activity.UNMERGE_DESTINATION}
                | {i.data["destination_id"] for i in item_list if i.type == Activity.UNMERGE_SOURCE}
            ),
        )

        return {
            item: {
                "user": users[str(item.user_id)] if item.user_id else None,
                "source": groups.get(item.data["source_id"])
                if item.type == Activity.UNMERGE_DESTINATION
                else None,
                "destination": groups.get(item.data["destination_id"])
                if item.type == Activity.UNMERGE_SOURCE
                else None,
                "commit": commits.get(item),
                "pull_request": pull_requests.get(item),
            }
            for item in item_list
        }

    def serialize(self, obj, attrs, user):
        if obj.type == Activity.SET_RESOLVED_IN_COMMIT:
            data = {"commit": attrs["commit"]}
        elif obj.type == Activity.SET_RESOLVED_IN_PULL_REQUEST:
            data = {"pullRequest": attrs["pull_request"]}
        elif obj.type == Activity.UNMERGE_DESTINATION:
            data = {"fingerprints": obj.data["fingerprints"], "source": attrs["source"]}
        elif obj.type == Activity.UNMERGE_SOURCE:
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


class OrganizationActivitySerializer(ActivitySerializer):
    def get_attrs(self, item_list, user):
        from sentry.api.serializers import GroupSerializer

        # TODO(dcramer); assert on relations
        attrs = super().get_attrs(item_list, user)

        groups = {
            d["id"]: d
            for d in serialize(
                {i.group for i in item_list if i.group_id},
                user,
                GroupSerializer(environment_func=self.environment_func),
            )
        }

        projects = {d["id"]: d for d in serialize({i.project for i in item_list}, user)}

        for item in item_list:
            attrs[item]["issue"] = groups[str(item.group_id)] if item.group_id else None
            attrs[item]["project"] = projects[str(item.project_id)]
        return attrs

    def serialize(self, obj, attrs, user):
        context = super().serialize(obj, attrs, user)
        context["issue"] = attrs["issue"]
        context["project"] = attrs["project"]
        return context
