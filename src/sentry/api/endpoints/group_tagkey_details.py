from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tagstore
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models.environment import Environment


@region_silo_endpoint
class GroupTagKeyDetailsEndpoint(GroupEndpoint, EnvironmentMixin):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, group, key) -> Response:
        """
        Retrieve Tag Details
        ````````````````````

        Returns details for given tag key related to an issue.

        :pparam string issue_id: the ID of the issue to retrieve.
        :pparam string key: the tag key to look the values up for.
        :auth: required
        """
        lookup_key = tagstore.backend.prefix_reserved_key(key)
        tenant_ids = {"organization_id": group.project.organization_id}
        try:
            environment_id = self._get_environment_id_from_request(
                request, group.project.organization_id
            )
        except Environment.DoesNotExist:
            # if the environment doesn't exist then the tag can't possibly exist
            raise ResourceDoesNotExist

        try:
            group_tag_key = tagstore.backend.get_group_tag_key(
                group,
                environment_id,
                lookup_key,
                tenant_ids=tenant_ids,
            )
        except tagstore.GroupTagKeyNotFound:
            raise ResourceDoesNotExist

        if group_tag_key.count is None:
            group_tag_key.count = tagstore.backend.get_group_tag_value_count(
                group.project_id, group.id, environment_id, lookup_key, tenant_ids=tenant_ids
            )

        if group_tag_key.top_values is None:
            group_tag_key.top_values = tagstore.backend.get_top_group_tag_values(
                group, environment_id, lookup_key, tenant_ids=tenant_ids
            )

        return Response(serialize(group_tag_key, request.user))
