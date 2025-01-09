from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tagstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.tags_examples import TagsExamples
from sentry.apidocs.parameters import GlobalParams, IssueParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.environment import Environment
from sentry.tagstore.types import TagKeySerializer, TagKeySerializerResponse


@extend_schema(tags=["Events"])
@region_silo_endpoint
class GroupTagKeyDetailsEndpoint(GroupEndpoint, EnvironmentMixin):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ISSUES

    @extend_schema(
        operation_id="Retrieve Tag Details",
        description="Return a list of values associated with this key for an issue. When paginated can return at most 1000 values.",
        parameters=[
            IssueParams.ISSUE_ID,
            IssueParams.ISSUES_OR_GROUPS,
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.KEY,
            GlobalParams.ENVIRONMENT,
        ],
        responses={
            200: inline_sentry_response_serializer("TagKeyDetailsDict", TagKeySerializerResponse),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[TagsExamples.GROUP_TAGKEY_DETAILS],
    )
    def get(self, request: Request, group, key) -> Response:
        """
        Returns the values and aggregate details of a given tag key related to an issue.
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
                group, environment_id, lookup_key, tenant_ids=tenant_ids
            )

        if group_tag_key.top_values is None:
            group_tag_key.top_values = tagstore.backend.get_top_group_tag_values(
                group, environment_id, lookup_key, tenant_ids=tenant_ids
            )

        return Response(serialize(group_tag_key, request.user, serializer=TagKeySerializer()))
