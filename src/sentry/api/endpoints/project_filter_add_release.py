from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_SUCCESS
from sentry.apidocs.parameters import GlobalParams


class AddReleaseFilterSerializer(serializers.Serializer):
    release = serializers.CharField(
        required=True,
        help_text="The release version to add to the inbound filters.",
    )


@region_silo_endpoint
@extend_schema(tags=["Projects"])
class ProjectFilterAddReleaseEndpoint(ProjectEndpoint):
    owner = ApiOwner.OWNERS_INGEST
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="Add Release to Inbound Filters",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            GlobalParams.PROJECT_ID_OR_SLUG,
        ],
        request=AddReleaseFilterSerializer,
        responses={
            200: RESPONSE_SUCCESS,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
        },
    )
    def post(self, request: Request, project) -> Response:
        """
        Add a release version to the project's inbound data filters.

        This will add the release to the filters:releases option, which causes
        future events from this release to be discarded during ingestion.
        """
        serializer = AddReleaseFilterSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        release_version = serializer.validated_data["release"]

        # Get current release filters
        current_filters = project.get_option("filters:releases", default="")

        # Parse existing filters (newline-separated)
        if current_filters:
            filter_list = [f.strip() for f in current_filters.split("\n") if f.strip()]
        else:
            filter_list = []

        # Add the new release if not already present
        if release_version not in filter_list:
            filter_list.append(release_version)

            # Update the option
            new_filters = "\n".join(filter_list)
            project.update_option("filters:releases", new_filters)

            # Create audit log entry
            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=project.id,
                event=audit_log.get_event_id("PROJECT_EDIT"),
                data={
                    "slug": project.slug,
                    "filters:releases": new_filters,
                    "added_release": release_version,
                },
            )

        return Response(
            {"detail": "Release filter added successfully", "release": release_version},
            status=200,
        )
