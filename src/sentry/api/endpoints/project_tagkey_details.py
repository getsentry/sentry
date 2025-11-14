from typing import int
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, tagstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environment_id
from sentry.api.serializers import serialize
from sentry.constants import PROTECTED_TAG_KEYS
from sentry.models.environment import Environment
from sentry.ratelimits.config import RateLimitConfig
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@region_silo_endpoint
class ProjectTagKeyDetailsEndpoint(ProjectEndpoint):
    owner = ApiOwner.UNOWNED
    publish_status = {
        "DELETE": ApiPublishStatus.UNKNOWN,
        "GET": ApiPublishStatus.UNKNOWN,
    }

    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "DELETE": {
                RateLimitCategory.IP: RateLimit(limit=1, window=1),
                RateLimitCategory.USER: RateLimit(limit=1, window=1),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=1, window=1),
            },
            "GET": {
                RateLimitCategory.IP: RateLimit(limit=10, window=1, concurrent_limit=10),
                RateLimitCategory.USER: RateLimit(limit=10, window=1, concurrent_limit=10),
                RateLimitCategory.ORGANIZATION: RateLimit(limit=20, window=1, concurrent_limit=5),
            },
        }
    )

    def get(self, request: Request, project, key) -> Response:
        lookup_key = tagstore.backend.prefix_reserved_key(key)

        try:
            environment_id = get_environment_id(request, project.organization_id)
        except Environment.DoesNotExist:
            # if the environment doesn't exist then the tag can't possibly exist
            raise ResourceDoesNotExist

        try:
            tagkey = tagstore.backend.get_tag_key(
                project.id,
                environment_id,
                lookup_key,
                tenant_ids={"organization_id": project.organization_id},
            )
        except tagstore.TagKeyNotFound:
            raise ResourceDoesNotExist

        return Response(serialize(tagkey, request.user))

    def delete(self, request: Request, project, key) -> Response:
        """
        Remove all occurrences of the given tag key.

            {method} {path}

        """
        if key in PROTECTED_TAG_KEYS:
            return Response(status=403)

        lookup_key = tagstore.backend.prefix_reserved_key(key)

        try:
            from sentry import eventstream

            eventstream_state = eventstream.backend.start_delete_tag(project.id, key)

            deleted = self.get_tag_keys_for_deletion(project, lookup_key)

            # NOTE: By sending the `end_delete_tag` message here we are making
            # the assumption that the `delete_tag_key` does its work
            # synchronously. As of this writing the Snuba `delete_tag_key` method
            # is a no-op and this message itself is what causes the deletion to
            # be done downstream.
            eventstream.backend.end_delete_tag(eventstream_state)
        except tagstore.TagKeyNotFound:
            raise ResourceDoesNotExist

        for tagkey in deleted:
            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=getattr(tagkey, "id", None),
                event=audit_log.get_event_id("TAGKEY_REMOVE"),
                data=tagkey.get_audit_log_data(),
            )

        return Response(status=204)

    def get_tag_keys_for_deletion(self, project, key):
        try:
            return [
                tagstore.backend.get_tag_key(
                    project_id=project.id,
                    key=key,
                    environment_id=None,
                    tenant_ids={"organization_id": project.organization_id},
                )
            ]
        except tagstore.TagKeyNotFound:
            return []
