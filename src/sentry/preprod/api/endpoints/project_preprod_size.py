from __future__ import annotations

import logging
from typing import Any, cast

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import internal_region_silo_endpoint
from sentry.models.project import Project
from sentry.preprod.api.bases.preprod_artifact_endpoint import PreprodArtifactEndpoint
from sentry.preprod.api.models.launchpad import PutSize
from sentry.preprod.api.request_utils import parse_request_with_pydantic
from sentry.preprod.authentication import (
    LaunchpadRpcPermission,
    LaunchpadRpcSignatureAuthentication,
)
from sentry.preprod.models import PreprodArtifact, PreprodArtifactSizeMetrics

logger = logging.getLogger(__name__)


@internal_region_silo_endpoint
class ProjectPreprodSizeWithIdentifierEndpoint(PreprodArtifactEndpoint):
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
        identifier: str,
        head_artifact: PreprodArtifact,
    ) -> Response:
        return do_put(request, project, identifier, head_artifact)


@internal_region_silo_endpoint
class ProjectPreprodSizeEndpoint(PreprodArtifactEndpoint):
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
        identifier = None
        return do_put(request, project, identifier, head_artifact)


def do_put(
    request: Request, project: Project, identifier: str | None, head_artifact: PreprodArtifact
) -> Response:
    put: PutSize = parse_request_with_pydantic(request, cast(Any, PutSize))

    metrics, _ = PreprodArtifactSizeMetrics.objects.get_or_create(
        preprod_artifact=head_artifact, identifier=identifier, identifier__isnull=identifier is None
    )

    match put.state:
        case PreprodArtifactSizeMetrics.SizeAnalysisState.FAILED:
            metrics.state = put.state
            metrics.error_code = put.error_code
            metrics.error_message = put.error_message
        case PreprodArtifactSizeMetrics.SizeAnalysisState.PROCESSING:
            metrics.state = put.state
        case PreprodArtifactSizeMetrics.SizeAnalysisState.PENDING:
            metrics.state = put.state
        case _:
            assert False, "unreachable"
    metrics.save()

    return Response({"artifactId": str(head_artifact.id)})
