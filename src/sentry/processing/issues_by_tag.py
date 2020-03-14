from __future__ import absolute_import

import six

from sentry import tagstore
from sentry.models import EventUser, Group, get_group_with_redirect, Project
from .base import BaseProcessor, ProcessingError


def get_project_and_group(project_id, group_id):
    try:
        project = Project.objects.get(id=project_id)
        # TODO(tkaemming): This should *actually* redirect, see similar
        # comment in ``GroupEndpoint.convert_args``.
        group, _ = get_group_with_redirect(group_id, queryset=Group.objects.filter(project=project))
        return (project, group)
    except Project.DoesNotExist:
        raise ProcessingError("Requested project does not exist")
    except Group.DoesNotExist:
        raise ProcessingError("Requested group does not exist")


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


def get_lookup_key(key):
    return six.text_type("sentry:{}").format(key) if tagstore.is_reserved_key(key) else key


def get_issues_list(*args, **kwargs):
    return tagstore.get_group_tag_value_iter(*args, **kwargs)


def validate_tag_key(project_id, environment_id, lookup_key):
    """
    Ensures the tag key exists, as it may have been deleted
    """
    try:
        tagstore.get_tag_key(project_id, environment_id, lookup_key)
    except tagstore.TagKeyNotFound:
        raise ProcessingError("Requested key does not exist")


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


class IssuesByTagProcessor(BaseProcessor):
    def __init__(self, project_id, group_id, key, environment_id):
        self.project = self.get_project(project_id)
        self.group = self.get_group(group_id)
        self.key = key
        self.environment_id = environment_id
        self.fields = self.get_fields(self.key)
        self.lookup_key = self.get_lookup_key(self.key)
        # Ensure the tag key exists, as it may have been deleted
        try:
            tagstore.get_tag_key(self.project.id, environment_id, self.lookup_key)
        except tagstore.TagKeyNotFound:
            raise ProcessingError("Requested key does not exist")
        self.callbacks = self.get_callbacks(self.key, self.group.project_id)

    def get_group(self, group_id):
        try:
            group, _ = get_group_with_redirect(
                group_id, queryset=Group.objects.filter(project=self.project)
            )
            return group
        except Group.DoesNotExist:
            raise ProcessingError("Requested group does not exist")

    def get_fields(self, key):
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

    def get_lookup_key(self, key):
        return six.text_type("sentry:{}".format(key)) if tagstore.is_reserved_key(key) else key

    def get_eventuser_callback(self, project_id):
        def attach_eventuser(items):
            users = EventUser.for_tags(project_id, [i.value for i in items])
            for item in items:
                item._eventuser = users.get(item.value)

        return attach_eventuser

    def get_callbacks(self, key, project_id):
        return [self.get_eventuser_callback(project_id)] if key == "user" else []

    def serialize_issue(self, item):
        result = {
            "value": item.value,
            "times_seen": item.times_seen,
            "last_seen": item.last_seen.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "first_seen": item.first_seen.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        }
        if self.key == "user":
            euser = item._eventuser
            result["id"] = euser.ident if euser else ""
            result["email"] = euser.email if euser else ""
            result["username"] = euser.username if euser else ""
            result["ip_address"] = euser.ip_address if euser else ""
        return result

    def get_raw_data(self, offset=0):
        """
        Returns list of GroupTagValues
        """
        return tagstore.get_group_tag_value_iter(
            project_id=self.group.project_id,
            group_id=self.group.id,
            environment_id=self.environment_id,
            key=self.lookup_key,
            callbacks=self.callbacks,
            offset=offset,
        )

    def get_serialized_data(self, offset=0):
        """
        Returns list of serialized GroupTagValue dictionaries
        """
        raw_data = self.get_raw_data(offset)
        return [self.serialize_issue(item) for item in raw_data]
