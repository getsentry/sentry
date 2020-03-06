from __future__ import absolute_import

import six

from sentry import tagstore
from sentry.models import EventUser, Group, get_group_with_redirect, Project


class DataExportProcessingError(Exception):
    pass


class IssuesByTag:
    def get_project_and_group(project_id, group_id):
        try:
            project = Project.objects.get(id=project_id)
            group, _ = get_group_with_redirect(
                group_id, queryset=Group.objects.filter(project=project)
            )
            return (project, group)
        except Project.DoesNotExist:
            raise DataExportProcessingError("Requested project does not exist")
        except Group.DoesNotExist:
            raise DataExportProcessingError("Requested group does not exist")

    def get_fields(key):
        if key == "user":
            return [
                "value",
                "id",
                "email",
                "username",
                "ip_address",
                "times_seen",
                "last_seen",
                "first_seen",
            ]
        else:
            return ["value", "times_seen", "last_seen", "first_seen"]

    def get_eventuser_callback(project_id):
        def wrapper(items):
            users = EventUser.for_tags(project_id, [i.value for i in items])
            for item in items:
                item._eventuser = users.get(item.value)

        return wrapper

    def get_issues_list(key, **kwargs):
        lookup_key = (
            six.text_type("sentry:{}").format(key) if tagstore.is_reserved_key(key) else key
        )
        return tagstore.get_group_tag_value_iter(key=lookup_key, **kwargs)

    def serialize_issue(item, key):
        result = {
            "value": item.value,
            "times_seen": item.times_seen,
            "last_seen": item.last_seen.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "first_seen": item.first_seen.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        }
        if key == "user":
            euser = item._eventuser
            result["id"] = euser.ident if euser else ""
            result["email"] = euser.email if euser else ""
            result["username"] = euser.username if euser else ""
            result["ip_address"] = euser.ip_address if euser else ""
        return result
