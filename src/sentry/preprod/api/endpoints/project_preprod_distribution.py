from __future__ import annotations

import logging

import orjson
import pydantic
from pydantic import BaseModel
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import internal_region_silo_endpoint
from sentry.models.project import Project
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.authentication import (
    LaunchpadRpcPermission,
    LaunchpadRpcSignatureAuthentication,
)
from sentry.preprod.models import PreprodArtifact

logger = logging.getLogger(__name__)


class PutDistribution(BaseModel):
    error_code: int
    error_message: str


@internal_region_silo_endpoint
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
        try:
            j = orjson.loads(request.body)
        except orjson.JSONDecodeError:
            raise serializers.ValidationError("Invalid json")
        try:
            put = PutDistribution(**j)
        except pydantic.ValidationError:
            logger.exception("Could not parse PutDistribution")
            raise serializers.ValidationError("Could not parse PutDistribution")

        head_artifact.installable_app_error_code = put.error_code
        head_artifact.installable_app_error_message = put.error_message
        head_artifact.save(
            update_fields=[
                "installable_app_error_code",
                "installable_app_error_message",
                "date_updated",
            ]
        )

        return Response({"artifactId": str(head_artifact.id)})
