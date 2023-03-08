from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tagstore
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environments
from sentry.api.serializers import serialize
from sentry.api.serializers.models.tagvalue import UserTagValueSerializer


@region_silo_endpoint
class GroupTagKeyValuesEndpoint(GroupEndpoint, EnvironmentMixin):
    def get(self, request: Request, group, key) -> Response:
        """
        List a Tag's Values
        ```````````````````

        Return a list of values associated with this key for an issue.
        When paginated can return at most 1000 values.

        :pparam string issue_id: the ID of the issue to retrieve.
        :pparam string key: the tag key to look the values up for.
        :auth: required
        """
        lookup_key = tagstore.prefix_reserved_key(key)

        environment_ids = [e.id for e in get_environments(request, group.project.organization)]
        tenant_ids = {"organization_id": group.project.organization_id}
        try:
            tagstore.get_group_tag_key(
                group,
                None,
                lookup_key,
                tenant_ids=tenant_ids,
            )
        except tagstore.GroupTagKeyNotFound:
            raise ResourceDoesNotExist
        sort = request.GET.get("sort")
        if sort == "date":
            order_by = "-last_seen"
        elif sort == "age":
            order_by = "-first_seen"
        elif sort == "count":
            order_by = "-times_seen"
        else:
            order_by = "-id"

        if key == "user":
            serializer_cls = UserTagValueSerializer(group.project_id)
        else:
            serializer_cls = None

        paginator = tagstore.get_group_tag_value_paginator(
            group, environment_ids, lookup_key, order_by=order_by, tenant_ids=tenant_ids
        )

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user, serializer_cls),
        )
