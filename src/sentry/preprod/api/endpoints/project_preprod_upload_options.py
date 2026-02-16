from __future__ import annotations

from django.conf import settings
from django.urls import reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.models.project import Project
from sentry.utils.http import absolute_uri


@region_silo_endpoint
class ProjectPreprodUploadOptionsEndpoint(ProjectEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ProjectReleasePermission,)

    def get(self, request: Request, project: Project) -> Response:
        if not settings.IS_DEV and not features.has(
            "organizations:preprod-snapshots", project.organization, actor=request.user
        ):
            return Response({"detail": "Feature not enabled"}, status=403)

        organization = project.organization

        objectstore_upload_url = absolute_uri(
            reverse(
                "sentry-api-0-organization-objectstore",
                kwargs={
                    "organization_id_or_slug": organization.id,
                    "path": "",
                },
            )
        )

        return Response(
            {
                "objectstoreUploadUrl": objectstore_upload_url,
                "objectstoreScopes": {
                    "orgId": organization.id,
                    "projectId": project.id,
                },
                "objectstoreToken": "placeholder",
                "retentionDays": 396,
            }
        )
