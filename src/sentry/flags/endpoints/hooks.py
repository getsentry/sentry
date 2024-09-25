import datetime
from typing import Any, TypedDict

from django.db import models
from django.utils import timezone
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.authentication import (
    ApiKeyAuthentication,
    OrgAuthTokenAuthentication,
    UserAuthTokenAuthentication,
)
from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, region_silo_model, sane_repr
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.models.organization import Organization
from sentry.utils.sdk import bind_organization_context


class OrganizationFlagHookPermission(OrganizationPermission):
    scope_map = {
        "POST": ["org:read", "org:write", "org:admin"],
    }


@region_silo_endpoint
class OrganizationFlagsHooksEndpoint(Endpoint):
    authentication_classes = (
        ApiKeyAuthentication,
        OrgAuthTokenAuthentication,
        UserAuthTokenAuthentication,
    )
    owner = ApiOwner.REPLAY
    permission_classes = (OrganizationFlagHookPermission,)
    publish_status = {
        "POST": ApiPublishStatus.PRIVATE,
    }

    def convert_args(
        self,
        request: Request,
        organization_id_or_slug: int | str,
        *args,
        **kwargs,
    ):
        try:
            if isinstance(organization_id_or_slug, int):
                organization = Organization.objects.get_from_cache(id=organization_id_or_slug)
            else:
                organization = Organization.objects.get_from_cache(slug=organization_id_or_slug)
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist

        self.check_object_permissions(request, organization)
        bind_organization_context(organization)

        kwargs["organization"] = organization
        return args, kwargs

    def post(self, request: Request, organization: Organization, provider: str) -> Response:
        try:
            row_data = handle_provider_event(provider, request.data, organization.id)
            FlagAuditLogModel.objects.create(**row_data)
            return Response(status=200)
        except InvalidProvider:
            raise ResourceDoesNotExist
        except DeserializationError as exc:
            return Response(exc.errors, status=400)


@region_silo_model
class FlagAuditLogModel(Model):
    __relocation_scope__ = RelocationScope.Excluded

    ACTION_TYPES = ((0, "created"), (1, "modified"), (2, "removed"))
    MODIFIED_BY_TYPE_TYPES = ((0, "email"), (1, "name"), (2, "id"))

    action = models.PositiveSmallIntegerField(choices=ACTION_TYPES)
    flag = models.CharField(max_length=100)
    modified_at = models.DateTimeField(default=timezone.now)
    modified_by = models.CharField(max_length=100)
    modified_by_type = models.PositiveSmallIntegerField(choices=MODIFIED_BY_TYPE_TYPES)
    organization_id = HybridCloudForeignKey("sentry.Organization", null=False, on_delete="CASCADE")
    tags = models.JSONField()

    class Meta:
        app_label = "flags"
        db_table = "flags_audit_log"
        indexes = (models.Index(fields=("flag",)),)

    __repr__ = sane_repr("organization_id", "flag")


"""Provider definitions.

Provider definitions are pure functions. They accept data and return data. Providers do not
initiate any IO operations. Instead they return commands in the form of the return type or
an exception. These commands inform the caller (the endpoint defintion) what IO must be
emitted to satisfy the request. This is done primarily to improve testability and test
performance but secondarily to allow easy extension of the endpoint without knowledge of
the underlying systems.
"""


class FlagAuditLogRow(TypedDict):
    """A complete flag audit log row instance."""

    action: str
    flag: str
    modified_at: datetime.datetime
    modified_by: str
    modified_by_type: str
    organization_id: int


class DeserializationError(Exception):
    """The request body could not be deserialized."""

    def __init__(self, errors):
        self.errors = errors


class InvalidProvider(Exception):
    """An unsupported provider type was specified."""

    ...


def handle_provider_event(
    provider: str,
    request_data: dict[str, Any],
    organization_id: int,
) -> FlagAuditLogRow:
    if provider == "flag-pole":
        return handle_flag_pole_event(request_data, organization_id)
    else:
        raise InvalidProvider(provider)


"""Flag pole provider definition.

If you are not Sentry you will not ever use this driver. Metadata provider by flag pole is
limited to what we can extract from the git repository on merge.
"""


class FlagPoleSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=("created", "modified"), required=True)
    flag = serializers.CharField(max_length=100, required=True)
    modified_at = serializers.DateTimeField(required=True)
    modified_by = serializers.CharField(required=True)


def handle_flag_pole_event(request_data: dict[str, Any], organization_id: int) -> FlagAuditLogRow:
    serializer = FlagPoleSerializer(data=request_data)
    if not serializer.is_valid():
        raise DeserializationError(serializer.errors)

    validated_data = serializer.validated_data

    return dict(
        action=validated_data["action"],
        flag=validated_data["flag"],
        modified_at=validated_data["modified_at"],
        modified_by=validated_data["modified_by"],
        modified_by_type="email",
        organization_id=organization_id,
    )
