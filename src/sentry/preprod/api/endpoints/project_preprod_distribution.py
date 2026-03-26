from __future__ import annotations

import logging
from typing import Any, cast

from pydantic import BaseModel, Field
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import internal_cell_silo_endpoint
from sentry.models.project import Project
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.api.endpoints.project_preprod_size import parse_request_with_pydantic
from sentry.preprod.authentication import (
    LaunchpadRpcPermission,
    LaunchpadRpcSignatureAuthentication,
)
from sentry.preprod.build_distribution_webhooks import send_build_distribution_webhook
from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)


class PutDistribution(BaseModel):
    error_code: int = Field(ge=0, le=3)
    error_message: str


@internal_cell_silo_endpoint
class ProjectPreprodDistributionEndpoint(PreprodArtifactEndpoint):
    owner = ApiOwner.EMERGE_TOOLS
    publish_status = {
        "PUT": ApiPublishStatus.PRIVATE,
    }
    authentication_classes = (LaunchpadRpcSignatureAuthentication,)
    permission_classes = (LaunchpadRpcPermission,)

    def put(
        self,
        request: Request,
        project: Project,
        head_artifact_id: int,
        head_artifact: PreprodArtifact,
    ) -> Response:
        put: PutDistribution = parse_request_with_pydantic(request, cast(Any, PutDistribution))

        head_artifact.installable_app_error_code = put.error_code
        head_artifact.installable_app_error_message = put.error_message
        head_artifact.save(
            update_fields=[
                "installable_app_error_code",
                "installable_app_error_message",
                "date_updated",
            ]
        )

        send_build_distribution_webhook(
            artifact=head_artifact,
            organization_id=project.organization_id,
        )

        return Response({"artifactId": str(head_artifact.id)})
