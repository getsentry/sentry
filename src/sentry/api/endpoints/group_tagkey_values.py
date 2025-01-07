from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import analytics, tagstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import EnvironmentMixin, region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.helpers.environments import get_environments
from sentry.api.serializers import serialize
from sentry.api.serializers.models.tagvalue import UserTagValueSerializer
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.tags_examples import TagsExamples
from sentry.apidocs.parameters import GlobalParams, IssueParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.tagstore.types import TagValueSerializerResponse


@extend_schema(tags=["Events"])
@region_silo_endpoint
class GroupTagKeyValuesEndpoint(GroupEndpoint, EnvironmentMixin):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ISSUES

    @extend_schema(
        operation_id="List a Tag's Values for an Issue",
        description="Returns a list of values associated with this key for an issue.\nReturns at most 1000 values when paginated.",
        parameters=[
            IssueParams.ISSUE_ID,
            IssueParams.ISSUES_OR_GROUPS,
            GlobalParams.ORG_ID_OR_SLUG,
            IssueParams.KEY,
            IssueParams.SORT,
            GlobalParams.ENVIRONMENT,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "TagKeyValuesDict", list[TagValueSerializerResponse]
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=[TagsExamples.GROUP_TAGKEY_VALUES],
    )
    def get(self, request: Request, group, key) -> Response:
        """
        List a Tag's Values
        """
        analytics.record(
            "eventuser_endpoint.request",
            project_id=group.project_id,
            endpoint="sentry.api.endpoints.group_tagkey_values.get",
        )
        lookup_key = tagstore.backend.prefix_reserved_key(key)

        environment_ids = [e.id for e in get_environments(request, group.project.organization)]
        tenant_ids = {"organization_id": group.project.organization_id}
        try:
            tagstore.backend.get_group_tag_key(
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

        paginator = tagstore.backend.get_group_tag_value_paginator(
            group, environment_ids, lookup_key, order_by=order_by, tenant_ids=tenant_ids
        )

        return self.paginate(
            request=request,
            paginator=paginator,
            on_results=lambda results: serialize(results, request.user, serializer_cls),
        )
