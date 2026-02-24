from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.urls import reverse
from objectstore_client import TimeToLive
from objectstore_client.metadata import format_expiration
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectReleasePermission
from sentry.api.utils import generate_region_url
from sentry.models.project import Project
from sentry.objectstore.types import ObjectstoreUploadOptions
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

        path = reverse(
            "sentry-api-0-organization-objectstore",
            kwargs={
                "organization_id_or_slug": organization.id,
                "path": "",
            },
        )
        url = absolute_uri(path, generate_region_url())

        options = ObjectstoreUploadOptions(
            url=url,
            scopes=[
                ("org", str(organization.id)),
                ("project", str(project.id)),
            ],
            expirationPolicy=format_expiration(
                TimeToLive(timedelta(days=396))
            ),  # Hardcoded for now
        )

        return Response({"objectstore": options})
