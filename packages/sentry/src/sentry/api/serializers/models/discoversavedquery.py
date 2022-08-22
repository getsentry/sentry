from collections import defaultdict

from django.db.models.query import prefetch_related_objects

from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.user import UserSerializer
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.discover.models import DiscoverSavedQuery
from sentry.utils.dates import outside_retention_with_modified_start, parse_timestamp


@register(DiscoverSavedQuery)
class DiscoverSavedQuerySerializer(Serializer):
    def get_attrs(self, item_list, user):
        prefetch_related_objects(item_list, "created_by")

        result = defaultdict(lambda: {"created_by": {}})

        user_serializer = UserSerializer()
        serialized_users = {
            user["id"]: user
            for user in serialize(
                [
                    discover_saved_query.created_by
                    for discover_saved_query in item_list
                    if discover_saved_query.created_by
                ],
                user=user,
                serializer=user_serializer,
            )
        }

        for discover_saved_query in item_list:
            result[discover_saved_query]["created_by"] = serialized_users.get(
                str(discover_saved_query.created_by_id)
            )

        return result

    def serialize(self, obj, attrs, user, **kwargs):
        query_keys = [
            "environment",
            "query",
            "fields",
            "widths",
            "conditions",
            "aggregations",
            "range",
            "start",
            "end",
            "orderby",
            "limit",
            "yAxis",
            "display",
            "topEvents",
        ]
        data = {
            "id": str(obj.id),
            "name": obj.name,
            "projects": [project.id for project in obj.projects.all()],
            "version": obj.version or obj.query.get("version", 1),
            "expired": False,
            "dateCreated": obj.date_created,
            "dateUpdated": obj.date_updated,
            "createdBy": attrs.get("created_by"),
        }

        for key in query_keys:
            if obj.query.get(key) is not None:
                data[key] = obj.query[key]

        # expire queries that are beyond the retention period
        if "start" in obj.query:
            start, end = parse_timestamp(obj.query["start"]), parse_timestamp(obj.query["end"])
            if start and end:
                data["expired"], data["start"] = outside_retention_with_modified_start(
                    start, end, obj.organization
                )

        if obj.query.get("all_projects"):
            data["projects"] = list(ALL_ACCESS_PROJECTS)

        return data
