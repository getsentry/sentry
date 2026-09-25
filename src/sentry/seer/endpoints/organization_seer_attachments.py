from __future__ import annotations

from typing import TypedDict

from django.http import HttpResponse
from django.utils.http import content_disposition_header
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_field
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, ratelimits
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.models.organization import Organization
from sentry.ratelimits.config import RateLimitConfig
from sentry.seer.agent.client_utils import has_seer_agent_access_with_detail
from sentry.seer.attachments import storage
from sentry.seer.attachments.models import (
    AttachmentError,
    AttachmentResponse,
    observe,
    validate_key,
)
from sentry.seer.attachments.safe_search import scan_image
from sentry.seer.attachments.validation import validate_upload
from sentry.types.ratelimit import RateLimit, RateLimitCategory


@extend_schema_field(OpenApiTypes.BINARY)
class AttachmentUploadField(serializers.FileField):
    """File bytes supplied by the multipart parser."""


class AttachmentUploadSerializer(serializers.Serializer):
    file = AttachmentUploadField(allow_empty_file=True)


class AttachmentBatchResponse(TypedDict):
    attachments: list[AttachmentResponse]
    missing: list[str]


class AttachmentErrorResponse(TypedDict):
    detail: str
    code: str


ATTACHMENT_SCHEMA = inline_sentry_response_serializer("ExplorerAttachment", AttachmentResponse)
BATCH_SCHEMA = inline_sentry_response_serializer("ExplorerAttachmentBatch", AttachmentBatchResponse)
ERROR_SCHEMA = inline_sentry_response_serializer("ExplorerAttachmentError", AttachmentErrorResponse)


class AttachmentPermission(OrganizationPermission):
    scope_map = {"GET": ["org:read"], "POST": ["org:read"]}


READ_LIMITS = {
    RateLimitCategory.IP: RateLimit(limit=100, window=60),
    RateLimitCategory.USER: RateLimit(limit=100, window=60),
    RateLimitCategory.ORGANIZATION: RateLimit(limit=1000, window=60),
}
UPLOAD_LIMITS = {
    RateLimitCategory.IP: RateLimit(limit=125, window=60),
    RateLimitCategory.USER: RateLimit(limit=125, window=60),
    RateLimitCategory.ORGANIZATION: RateLimit(limit=500, window=3600),
}


def check_attachment_rate_limits(request: Request, organization: Organization) -> None:
    # The API middleware chooses one caller category. Also enforce all three
    # quotas here, sharing a read bucket between metadata and content requests.
    operation = "upload" if request.method == "POST" else "read"
    limits = UPLOAD_LIMITS if request.method == "POST" else READ_LIMITS
    identities = (
        (RateLimitCategory.ORGANIZATION, organization.id),
        (RateLimitCategory.USER, request.user.id),
        (RateLimitCategory.IP, request.META.get("REMOTE_ADDR")),
    )
    for category, identity in identities:
        if identity is None:
            continue
        quota = limits[category]
        if ratelimits.backend.is_limited(
            f"seer:attachments:{operation}:{category.value}:{identity}",
            limit=quota.limit,
            window=quota.window,
        ):
            raise AttachmentError(
                "rate_limited", "Attachment request limit exceeded. Try again later.", 429
            )


def require_explorer(request: Request, organization: Organization) -> None:
    has_access, error = has_seer_agent_access_with_detail(organization, request.user)
    if not has_access:
        raise PermissionDenied(error)


@cell_silo_endpoint
class OrganizationSeerAttachmentsEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"POST": ApiPublishStatus.PRIVATE, "GET": ApiPublishStatus.PRIVATE}
    permission_classes = (AttachmentPermission,)
    parser_classes = (MultiPartParser,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(
        limit_overrides={
            "POST": UPLOAD_LIMITS,
            "GET": READ_LIMITS,
        }
    )

    @extend_schema(
        tags=["Seer"],
        request=AttachmentUploadSerializer,
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        responses={
            201: ATTACHMENT_SCHEMA,
            400: ERROR_SCHEMA,
            413: ERROR_SCHEMA,
            503: ERROR_SCHEMA,
        },
    )
    def post(self, request: Request, organization: Organization) -> Response:
        require_explorer(request, organization)
        if not features.has(
            "organizations:seer-explorer-attachments", organization, actor=request.user
        ):
            raise PermissionDenied("Attachment uploads are not enabled.")
        check_attachment_rate_limits(request, organization)
        serializer = AttachmentUploadSerializer(data=request.data)
        if (
            not serializer.is_valid()
            or list(request.FILES) != ["file"]
            or len(request.FILES.getlist("file")) != 1
        ):
            raise AttachmentError("invalid_upload", "Upload exactly one file in the file field.")
        data, attachment = validate_upload(serializer.validated_data["file"])
        if attachment.kind == "image":
            scan_image(data)
        key = storage.put(data, attachment)
        return Response(attachment.response(key), status=201)

    @extend_schema(
        tags=["Seer"],
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter(
                "key",
                str,
                OpenApiParameter.QUERY,
                required=True,
                many=True,
                description="Between one and 50 opaque attachment keys.",
            ),
        ],
        responses={
            200: BATCH_SCHEMA,
            400: ERROR_SCHEMA,
            503: ERROR_SCHEMA,
        },
    )
    def get(self, request: Request, organization: Organization) -> Response:
        require_explorer(request, organization)
        check_attachment_rate_limits(request, organization)
        attachments, missing = storage.metadata_batch(request.query_params.getlist("key"))
        result: AttachmentBatchResponse = {"attachments": attachments, "missing": missing}
        return Response(result)


@cell_silo_endpoint
class OrganizationSeerAttachmentContentEndpoint(OrganizationEndpoint):
    owner = ApiOwner.ML_AI
    publish_status = {"GET": ApiPublishStatus.PRIVATE}
    permission_classes = (AttachmentPermission,)
    enforce_rate_limit = True
    rate_limits = RateLimitConfig(limit_overrides={"GET": READ_LIMITS})

    @extend_schema(
        tags=["Seer"],
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
            OpenApiParameter("key", str, OpenApiParameter.PATH),
        ],
        responses={
            (200, "image/jpeg"): OpenApiTypes.BINARY,
            (200, "image/png"): OpenApiTypes.BINARY,
            (200, "image/webp"): OpenApiTypes.BINARY,
            (200, "application/pdf"): OpenApiTypes.BINARY,
            (200, "text/plain"): OpenApiTypes.BINARY,
            400: ERROR_SCHEMA,
            404: ERROR_SCHEMA,
            503: ERROR_SCHEMA,
        },
    )
    def get(self, request: Request, organization: Organization, key: str) -> HttpResponse:
        require_explorer(request, organization)
        check_attachment_rate_limits(request, organization)
        validate_key(key)
        with observe("preview"):
            data, attachment = storage.read(key)
            content_type = (
                "text/plain; charset=utf-8"
                if attachment.kind in ("json", "markdown")
                else attachment.content_type
            )
            response = HttpResponse(data, content_type=content_type)
            if disposition := content_disposition_header(False, attachment.filename):
                response["Content-Disposition"] = disposition
            response["X-Content-Type-Options"] = "nosniff"
            response["Cache-Control"] = "private, no-store"
            return response
