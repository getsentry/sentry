from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tagstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.models.environment import Environment


@region_silo_endpoint
class ProjectTagKeyValuesEndpoint(ProjectEndpoint, EnvironmentMixin):
    owner = ApiOwner.PERFORMANCE
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    def get(self, request: Request, project, key) -> Response:
        """
        List a Tag's Values
        ```````````````````

        Return a list of values associated with this key.  The `query`
        parameter can be used to to perform a "contains" match on
        values.
        When paginated can return at most 1000 values.

        :pparam string organization_slug: the slug of the organization.
        :pparam string project_slug: the slug of the project.
        :pparam string key: the tag key to look up.
        :auth: required
        """
        lookup_key = tagstore.backend.prefix_reserved_key(key)
        tenant_ids = {"organization_id": project.organization_id}
        try:
            environment_id = self._get_environment_id_from_request(request, project.organization_id)
        except Environment.DoesNotExist:
            # if the environment doesn't exist then the tag can't possibly exist
            raise ResourceDoesNotExist

        try:
            tagkey = tagstore.backend.get_tag_key(
                project.id,
                environment_id,
                lookup_key,
                tenant_ids=tenant_ids,
            )
        except tagstore.TagKeyNotFound:
            raise ResourceDoesNotExist

        start, end = get_date_range_from_params(request.GET)

        paginator = tagstore.backend.get_tag_value_paginator(
            project.id,
            environment_id,
            tagkey.key,
            start=start,
            end=end,
            query=request.GET.get("query"),
            order_by="-last_seen",
            tenant_ids=tenant_ids,
        )

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user),
        )
