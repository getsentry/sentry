from typing import int
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tagstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environment_id
from sentry.api.serializers import serialize
from sentry.api.utils import get_date_range_from_params
from sentry.models.environment import Environment
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@region_silo_endpoint
class ProjectTagKeyValuesEndpoint(ProjectEndpoint):
    owner = ApiOwner.UNOWNED
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
    }

    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=10, window=1, concurrent_limit=10),
                RateLimitCategory.USER: RateLimit(limit=10, window=1, concurrent_limit=10),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=20, window=1, concurrent_limit=5),
            }
        }
    )

    def get(self, request: Request, project, key) -> Response:
        """
        List a Tag's Values
        ```````````````````

        Return a list of values associated with this key.  The `query`
        parameter can be used to to perform a "contains" match on
        values.
        When paginated can return at most 1000 values.

        :pparam string organization_id_or_slug: the id or slug of the organization.
        :pparam string project_id_or_slug: the id or slug of the project.
        :pparam string key: the tag key to look up.
        :auth: required
        """
        lookup_key = tagstore.backend.prefix_reserved_key(key)
        tenant_ids = {"organization_id": project.organization_id}
        try:
            environment_id = get_environment_id(request, project.organization_id)
        except Environment.DoesNotExist:
            # if the environment doesn't exist then the tag can't possibly exist
            raise ResourceDoesNotExist

        # Flags are stored on the same table as tags but on a different column. Ideally both
        # could be queried in a single request. But at present we're not sure if we want to
        # treat tags and flags as the same or different and in which context.
        if request.GET.get("useFlagsBackend") == "1":
            backend = tagstore.flag_backend
        else:
            backend = tagstore.backend

        try:
            tagkey = backend.get_tag_key(
                project.id,
                environment_id,
                lookup_key,
                tenant_ids=tenant_ids,
            )
        except tagstore.TagKeyNotFound:
            raise ResourceDoesNotExist

        start, end = get_date_range_from_params(request.GET)

        paginator = backend.get_tag_value_paginator(
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
