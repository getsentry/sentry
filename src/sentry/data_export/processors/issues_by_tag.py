from sentry import tagstore
from sentry.models import EventUser, Group, Project, get_group_with_redirect

from ..base import ExportError


class IssuesByTagProcessor:
    """
    Processor for exports of issues data based on a provided tag
    """

    def __init__(self, project_id, group_id, key, environment_id):
        self.project = self.get_project(project_id)
        self.group = self.get_group(group_id, self.project)
        self.key = key
        self.environment_id = environment_id
        self.header_fields = self.get_header_fields(self.key)
        self.lookup_key = self.get_lookup_key(self.key)
        # Ensure the tag key exists, as it may have been deleted
        try:
            tagstore.get_tag_key(self.project.id, environment_id, self.lookup_key)
        except tagstore.TagKeyNotFound:
            raise ExportError("Requested key does not exist")
        self.callbacks = self.get_callbacks(self.key, self.group.project_id)

    @staticmethod
    def get_project(project_id):
        try:
            project = Project.objects.get_from_cache(id=project_id)
            return project
        except Project.DoesNotExist:
            raise ExportError("Requested project does not exist")

    @staticmethod
    def get_group(group_id, project):
        try:
            group, _ = get_group_with_redirect(
                group_id, queryset=Group.objects.filter(project=project)
            )
            return group
        except Group.DoesNotExist:
            raise ExportError("Requested issue does not exist")

    @staticmethod
    def get_header_fields(key):
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
    def get_lookup_key(key):
        return str(f"sentry:{key}") if tagstore.is_reserved_key(key) else key

    @staticmethod
    def get_eventuser_callback(project_id):
        def attach_eventuser(items):
            users = EventUser.for_tags(project_id, [i.value for i in items])
            for item in items:
                item._eventuser = users.get(item.value)

        return attach_eventuser

    @staticmethod
    def get_callbacks(key, project_id):
        return [IssuesByTagProcessor.get_eventuser_callback(project_id)] if key == "user" else []

    @staticmethod
    def serialize_row(item, key):
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

    def get_raw_data(self, limit=1000, offset=0):
        """
        Returns list of GroupTagValues
        """
        return tagstore.get_group_tag_value_iter(
            project_id=self.group.project_id,
            group_id=self.group.id,
            environment_ids=[self.environment_id],
            key=self.lookup_key,
            callbacks=self.callbacks,
            limit=limit,
            offset=offset,
        )

    def get_serialized_data(self, limit=1000, offset=0):
        """
        Returns list of serialized GroupTagValue dictionaries
        """
        raw_data = self.get_raw_data(limit=limit, offset=offset)
        return [self.serialize_row(item, self.key) for item in raw_data]
