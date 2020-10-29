from __future__ import absolute_import

import six
from sentry.api.serializers import Serializer, register, serialize
from sentry.api.serializers.models.user import UserSerializer
from sentry.constants import ALL_ACCESS_PROJECTS
from sentry.discover.models import DiscoverSavedQuery


@register(DiscoverSavedQuery)
class DiscoverSavedQuerySerializer(Serializer):
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
        ]
        data = {
            "id": six.text_type(obj.id),
            "name": obj.name,
            "projects": [project.id for project in obj.projects.all()],
            "version": obj.version or obj.query.get("version", 1),
            "dateCreated": obj.date_created,
            "dateUpdated": obj.date_updated,
            "createdBy": serialize(obj.created_by, serializer=UserSerializer())
            if obj.created_by
            else None,
        }

        for key in query_keys:
            if obj.query.get(key) is not None:
                data[key] = obj.query[key]

        if obj.query.get("all_projects"):
            data["projects"] = list(ALL_ACCESS_PROJECTS)

        return data
