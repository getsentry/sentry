from django.db import models
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import JSONField, Serializer, ValidationError

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.apidocs.constants import RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.parameters import GlobalParams
from sentry.codecov.base import CodecovEndpoint
from sentry.db.models.fields.jsonfield import JSONField as ModelJSONField
from sentry.models import Organization

# --- New Model for PR Review Config ---


class PrReviewConfig(models.Model):
    """
    Stores PR review config as a JSON blob for each organization.
    """

    organization = models.OneToOneField(
        "sentry.Organization",
        on_delete=models.CASCADE,
        related_name="pr_review_config",
        db_index=True,
    )
    config = ModelJSONField(default=dict)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_prreviewconfig"


# --- Serializer ---


class PrReviewConfigSerializer(Serializer):
    """
    Serializer for PR review config.
    Accepts and returns a JSON object.
    """

    config = JSONField(required=True)

    def to_representation(self, instance):
        # instance is a PrReviewConfig or dict
        if isinstance(instance, dict):
            return instance
        if instance is None:
            return {}
        return {"config": instance.config}

    def to_internal_value(self, data):
        # Accepts a dict as the config
        if not isinstance(data, dict):
            raise ValidationError("Config must be a dictionary")
        if "config" not in data:
            raise ValidationError("Missing 'config' key")
        if not isinstance(data["config"], dict):
            raise ValidationError("'config' must be a dictionary")
        return {"config": data["config"]}


@extend_schema(tags=["Prevent"])
@region_silo_endpoint
class PrReviewConfigEndpoint(CodecovEndpoint):
    owner = ApiOwner.CODECOV
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "PUT": ApiPublishStatus.PUBLIC,
    }

    @extend_schema(
        operation_id="Get PR review config for an organization",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        request=None,
        responses={
            200: PrReviewConfigSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, organization: Organization, **kwargs) -> Response:
        """
        Retrieves the PR review config for the given organization.
        The config is stored in the PrReviewConfig table.
        """
        try:
            pr_review_config = PrReviewConfig.objects.get(organization=organization)
            config = pr_review_config.config
        except PrReviewConfig.DoesNotExist:
            config = {}
        return Response({"config": config}, status=status.HTTP_200_OK)

    @extend_schema(
        operation_id="Update PR review config for an organization",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        request=PrReviewConfigSerializer,
        responses={
            200: PrReviewConfigSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(self, request: Request, organization: Organization, **kwargs) -> Response:
        """
        Updates the PR review config for the given organization.
        The config is saved in the PrReviewConfig table.
        """
        serializer = PrReviewConfigSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"detail": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )
        config = serializer.validated_data["config"]
        pr_review_config, _created = PrReviewConfig.objects.get_or_create(
            organization=organization,
            defaults={"config": config},
        )
        if not _created:
            pr_review_config.config = config
            pr_review_config.save(update_fields=["config"])
        return Response({"config": config}, status=status.HTTP_200_OK)
