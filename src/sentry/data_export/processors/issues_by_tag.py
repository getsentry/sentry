from __future__ import annotations

from typing import NamedTuple

from sentry import tagstore
from sentry.models.group import Group, get_group_with_redirect
from sentry.models.project import Project
from sentry.tagstore.types import GroupTagValue
from sentry.utils.eventuser import EventUser

from ..base import ExportError


class GroupTagValueAndEventUser(NamedTuple):
    value: GroupTagValue
    eventuser: EventUser | None


class IssuesByTagProcessor:
    """
    Processor for exports of issues data based on a provided tag
    """

    def __init__(
        self,
        project_id: int,
        group_id: int,
        key: str,
        environment_id: int | None,
        tenant_ids: dict[str, str | int] | None = None,
    ):
        self.project = self.get_project(project_id)
        self.group = self.get_group(group_id, self.project)
        self.key = key
        self.environment_id = environment_id
        self.header_fields = self.get_header_fields(self.key)
        self.lookup_key = self.get_lookup_key(self.key)
        # Ensure the tag key exists, as it may have been deleted
        try:
            tagstore.backend.get_tag_key(
                self.project.id, environment_id, self.lookup_key, tenant_ids=tenant_ids
            )
        except tagstore.TagKeyNotFound:
            raise ExportError("Requested key does not exist")

    @staticmethod
    def get_project(project_id: int) -> Project:
        try:
            project = Project.objects.get_from_cache(id=project_id)
            return project
        except Project.DoesNotExist:
            raise ExportError("Requested project does not exist")

    @staticmethod
    def get_group(group_id: int, project: Project) -> Group:
        try:
            group, _ = get_group_with_redirect(
                group_id, queryset=Group.objects.filter(project=project)
            )
            return group
        except Group.DoesNotExist:
            raise ExportError("Requested issue does not exist")

    @staticmethod
    def get_header_fields(key: str) -> list[str]:
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

    @staticmethod
    def get_lookup_key(key: str) -> str:
        return f"sentry:{key}" if tagstore.backend.is_reserved_key(key) else key

    @staticmethod
    def serialize_row(item: GroupTagValueAndEventUser, key: str) -> dict[str, str]:
        result = {
            "value": item.value.value,
            "times_seen": item.value.times_seen,
            "last_seen": item.value.last_seen.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "first_seen": item.value.first_seen.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        }
        if key == "user":
            euser = item.eventuser
            result["id"] = euser.user_ident if euser and isinstance(euser, EventUser) else ""
            result["email"] = euser.email if euser else ""
            result["username"] = euser.username if euser else ""
            result["ip_address"] = euser.ip_address if euser else ""
        return result

    def get_raw_data(self, limit: int = 1000, offset: int = 0) -> list[GroupTagValueAndEventUser]:
        """
        Returns list of GroupTagValues
        """
        items = tagstore.backend.get_group_tag_value_iter(
            group=self.group,
            environment_ids=[self.environment_id],
            key=self.lookup_key,
            limit=limit,
            offset=offset,
            tenant_ids={"organization_id": self.project.organization_id},
        )
        if self.key == "user":
            users = EventUser.for_tags(self.group.project_id, [i.value for i in items])
        else:
            users = {}
        return [GroupTagValueAndEventUser(item, users.get(item.value)) for item in items]

    def get_serialized_data(self, limit: int = 1000, offset: int = 0) -> list[dict[str, str]]:
        """
        Returns list of serialized GroupTagValue dictionaries
        """
        raw_data = self.get_raw_data(limit=limit, offset=offset)
        return [self.serialize_row(item, self.key) for item in raw_data]
