import datetime
from typing import NotRequired, TypedDict

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, options, tagstore
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.environments import get_environment_id
from sentry.api.utils import clamp_date_range, default_start_end_dates
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.constants import DS_DENYLIST, PROTECTED_TAG_KEYS
from sentry.models.environment import Environment


class ProjectTagKeyResponse(TypedDict):
    key: str
    name: str
    canDelete: bool
    # Only included when `includeValuesSeen` is not disabled.
    uniqueValues: NotRequired[int]


@extend_schema(tags=["Projects"])
@cell_silo_endpoint
class ProjectTagsEndpoint(ProjectEndpoint):
    owner = ApiOwner.UNOWNED
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="List a Project's Tag Keys",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
            OpenApiParameter(
                name="includeValuesSeen",
                location="query",
                required=False,
                type=str,
                description="Set to `0` to omit the `uniqueValues` count for each tag key.",
            ),
            OpenApiParameter(
                name="onlySamplingTags",
                location="query",
                required=False,
                type=str,
                description="Set to `1` to only return tag keys relevant to dynamic sampling.",
            ),
            OpenApiParameter(
                name="useFlagsBackend",
                location="query",
                required=False,
                type=str,
                description="Set to `1` to query feature flags instead of tags.",
            ),
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListProjectTagKeys", list[ProjectTagKeyResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project) -> Response[list[ProjectTagKeyResponse]]:
        """
        Return a list of the tag keys that have been seen within a project.
        """
        try:
            environment_id = get_environment_id(request, project.organization_id)
        except Environment.DoesNotExist:
            tag_keys = []
        else:
            kwargs: dict = {}
            if request.GET.get("onlySamplingTags") == "1":
                kwargs["denylist"] = DS_DENYLIST

            # Flags are stored on the same table as tags but on a different column. Ideally both
            # could be queried in a single request. But at present we're not sure if we want to
            # treat tags and flags as the same or different and in which context.
            use_flag_backend = request.GET.get("useFlagsBackend") == "1"
            if use_flag_backend:
                backend = tagstore.flag_backend
            else:
                backend = tagstore.backend

            include_values_seen = request.GET.get("includeValuesSeen") != "0"

            if features.has("organizations:tag-key-sample-n", project.organization):
                # Tag queries longer than 14 days tend to time out for large customers. For getting a list of tags, clamping to 14 days is a reasonable compromise of speed vs. completeness
                (start, end) = clamp_date_range(
                    default_start_end_dates(),
                    datetime.timedelta(days=options.get("visibility.tag-key-max-date-range.days")),
                )
                kwargs["start"] = start
                kwargs["end"] = end

            tag_keys = sorted(
                backend.get_tag_keys(
                    project.id,
                    environment_id,
                    tenant_ids={"organization_id": project.organization_id},
                    # We might be able to stop including these values, but this
                    # is a pretty old endpoint, so concerned about breaking
                    # existing api consumers.
                    include_values_seen=include_values_seen,
                    **kwargs,
                ),
                key=lambda x: x.key,
            )

        data: list[ProjectTagKeyResponse] = []
        for tag_key in tag_keys:
            entry: ProjectTagKeyResponse = {
                "key": tagstore.backend.get_standardized_key(tag_key.key),
                "name": tagstore.backend.get_tag_key_label(tag_key.key),
                "canDelete": tag_key.key not in PROTECTED_TAG_KEYS and not use_flag_backend,
            }
            if include_values_seen:
                entry["uniqueValues"] = tag_key.values_seen
            data.append(entry)

        return Response(data)
