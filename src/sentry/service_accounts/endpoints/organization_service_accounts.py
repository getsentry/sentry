"""Service account management APIs.

These run in control, next to the `ServiceAccount` table. The viewer-context endpoint
runs in the cell and reads the account's `ServiceAccountReplica`.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, NotRequired, TypedDict, cast

from django.db import IntegrityError, router, transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.organization import (
    ControlSiloOrganizationEndpoint,
    OrganizationPermission,
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import Serializer, serialize
from sentry.apidocs.constants import (
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.hybridcloud.models.outbox import outbox_context
from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcUserOrganizationContext,
    organization_service,
)
from sentry.service_accounts.models import (
    GRANTABLE_SCOPES,
    MAX_NAME_LENGTH,
    ServiceAccount,
    ServiceAccountProject,
)

FEATURE_FLAG = "organizations:service-accounts"
MAX_PROJECT_IDS_PER_REQUEST = 1000

DUPLICATE_NAME_ERROR = "A service account with this name already exists."

SERVICE_ACCOUNT_ID = OpenApiParameter(
    name="service_account_id",
    description="The ID of the service account.",
    required=True,
    type=str,
    location="path",
)


class ServiceAccountResponse(TypedDict):
    id: str
    name: str
    scopes: list[str]
    projectIds: list[str]
    isActive: bool
    dateCreated: datetime


class ServiceAccountCreateRequestData(TypedDict):
    name: str
    scopes: list[str]
    projectIds: NotRequired[list[int] | None]
    isActive: NotRequired[bool]


class ServiceAccountUpdateRequestData(TypedDict, total=False):
    name: str
    scopes: list[str]
    projectIds: list[int] | None
    isActive: bool


class ServiceAccountSerializer(Serializer[ServiceAccountResponse]):
    def get_attrs(
        self, item_list: Sequence[ServiceAccount], user: Any, **kwargs: Any
    ) -> dict[ServiceAccount, dict[str, Any]]:
        project_ids: defaultdict[int, list[int]] = defaultdict(list)
        for service_account_id, project_id in ServiceAccountProject.objects.filter(
            service_account_id__in=[item.id for item in item_list]
        ).values_list("service_account_id", "project_id"):
            project_ids[service_account_id].append(project_id)
        return {item: {"project_ids": sorted(project_ids[item.id])} for item in item_list}

    def serialize(
        self, obj: ServiceAccount, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> ServiceAccountResponse:
        return {
            "id": str(obj.id),
            "name": obj.name,
            "scopes": sorted(obj.scope_list),
            "projectIds": [str(project_id) for project_id in attrs["project_ids"]],
            "isActive": obj.is_active,
            "dateCreated": obj.date_added,
        }


def _audit_log_data(response: ServiceAccountResponse) -> dict[str, Any]:
    return {
        "name": response["name"],
        "scopes": response["scopes"],
        "project_ids": response["projectIds"],
        "is_active": response["isActive"],
    }


def _replace_projects(service_account: ServiceAccount, project_ids: Sequence[int]) -> None:
    existing = set()
    # Delete links one at a time: a queryset delete wouldn't write the account's outbox.
    for link in ServiceAccountProject.objects.filter(service_account=service_account):
        if link.project_id in project_ids:
            existing.add(link.project_id)
        else:
            link.delete()
    ServiceAccountProject.objects.bulk_create(
        ServiceAccountProject(service_account=service_account, project_id=project_id)
        for project_id in project_ids
        if project_id not in existing
    )


class ServiceAccountCreateSerializer(serializers.Serializer):
    name = serializers.CharField(
        max_length=MAX_NAME_LENGTH, help_text="The name of the service account."
    )
    scopes = serializers.ListField(
        child=serializers.ChoiceField(choices=sorted(GRANTABLE_SCOPES)),
        allow_empty=False,
        help_text="Scopes granted to the service account. You can only grant scopes you have.",
    )
    projectIds = serializers.ListField(
        child=serializers.IntegerField(),
        max_length=MAX_PROJECT_IDS_PER_REQUEST,
        required=False,
        allow_null=True,
        help_text=(
            "Projects the service account can access when the organization doesn't have open"
            " membership. Ignored while open membership is on, like team membership for people."
        ),
    )
    isActive = serializers.BooleanField(
        required=False, help_text="Whether the service account can be used. Defaults to true."
    )

    def validate_projectIds(self, project_ids: list[int] | None) -> list[int]:
        if not project_ids:
            return []
        access = self.context["access"]
        requested = set(project_ids)
        candidates = (
            requested if access.has_global_access else requested & access.accessible_project_ids
        )
        grantable = (
            set(
                organization_service.get_active_project_ids(
                    organization_id=self.context["organization"].id, project_ids=sorted(candidates)
                )
            )
            if candidates
            else set()
        )
        ungrantable = requested - grantable
        if ungrantable:
            raise serializers.ValidationError(
                f"You can't grant access to projects: {', '.join(map(str, sorted(ungrantable)))}"
            )
        return sorted(requested)

    def validate_scopes(self, scopes: list[str]) -> list[str]:
        ungrantable = set(scopes) - self.context["access"].scopes
        if ungrantable:
            raise serializers.ValidationError(
                f"You can't grant scopes you don't have: {', '.join(sorted(ungrantable))}"
            )
        return sorted(set(scopes))


class ServiceAccountUpdateSerializer(ServiceAccountCreateSerializer):
    name = serializers.CharField(
        max_length=MAX_NAME_LENGTH, required=False, help_text="The name of the service account."
    )
    scopes = serializers.ListField(
        child=serializers.ChoiceField(choices=sorted(GRANTABLE_SCOPES)),
        allow_empty=False,
        required=False,
        help_text="Scopes granted to the service account. You can only grant scopes you have.",
    )


class ServiceAccountPermission(OrganizationPermission):
    scope_map = {
        "GET": ["org:read", "org:write", "org:admin"],
        "POST": ["org:admin"],
        "PUT": ["org:admin"],
        "DELETE": ["org:admin"],
    }


class OrganizationServiceAccountEndpointBase(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.COMMUNITY
    permission_classes = (ServiceAccountPermission,)

    def convert_args(
        self, request: Request, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        if not features.has(FEATURE_FLAG, kwargs["organization"], actor=request.user):
            raise ResourceDoesNotExist
        return args, kwargs


@control_silo_endpoint
class OrganizationServiceAccountIndexEndpoint(OrganizationServiceAccountEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }

    @extend_schema(
        operation_id="List an Organization's Service Accounts",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        responses={
            200: inline_sentry_response_serializer(
                "ListServiceAccountsResponse", list[ServiceAccountResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        return self.paginate(
            request=request,
            queryset=ServiceAccount.objects.filter(organization_id=organization.id),
            order_by="id",
            paginator_cls=OffsetPaginator,
            on_results=lambda results: serialize(
                results, request.user, serializer=ServiceAccountSerializer()
            ),
        )

    @extend_schema(
        operation_id="Create a Service Account",
        parameters=[GlobalParams.ORG_ID_OR_SLUG],
        request=ServiceAccountCreateSerializer,
        responses={
            201: inline_sentry_response_serializer(
                "CreateServiceAccountResponse", ServiceAccountResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def post(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
    ) -> Response:
        serializer = ServiceAccountCreateSerializer(
            data=request.data, context={"access": request.access, "organization": organization}
        )
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        data = cast(ServiceAccountCreateRequestData, serializer.validated_data)

        try:
            with outbox_context(transaction.atomic(using=router.db_for_write(ServiceAccount))):
                service_account = ServiceAccount.objects.create(
                    organization_id=organization.id,
                    name=data["name"],
                    scope_list=data["scopes"],
                    is_active=data.get("isActive", True),
                    created_by_id=request.user.id,
                )
                ServiceAccountProject.objects.bulk_create(
                    ServiceAccountProject(service_account=service_account, project_id=project_id)
                    for project_id in data.get("projectIds") or ()
                )
        except IntegrityError:
            # The (organization_id, name) unique constraint is the duplicate name check.
            return Response({"detail": {"name": [DUPLICATE_NAME_ERROR]}}, status=400)

        response = serialize(service_account, request.user, serializer=ServiceAccountSerializer())
        self.create_audit_entry(
            request,
            organization=organization,
            target_object=service_account.id,
            event=audit_log.get_event_id("SERVICE_ACCOUNT_ADD"),
            data=_audit_log_data(response),
        )
        return Response(response, status=201)


@control_silo_endpoint
class OrganizationServiceAccountDetailsEndpoint(OrganizationServiceAccountEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

    def convert_args(
        self, request: Request, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        try:
            kwargs["service_account"] = ServiceAccount.objects.get(
                organization_id=kwargs["organization"].id,
                id=kwargs.pop("service_account_id"),
            )
        except ServiceAccount.DoesNotExist:
            raise ResourceDoesNotExist
        return args, kwargs

    @extend_schema(
        operation_id="Retrieve a Service Account",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, SERVICE_ACCOUNT_ID],
        responses={
            200: inline_sentry_response_serializer(
                "RetrieveServiceAccountResponse", ServiceAccountResponse
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
        service_account: ServiceAccount,
    ) -> Response:
        return Response(
            serialize(service_account, request.user, serializer=ServiceAccountSerializer())
        )

    @extend_schema(
        operation_id="Update a Service Account",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, SERVICE_ACCOUNT_ID],
        request=ServiceAccountUpdateSerializer,
        responses={
            200: inline_sentry_response_serializer(
                "UpdateServiceAccountResponse", ServiceAccountResponse
            ),
            400: RESPONSE_BAD_REQUEST,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def put(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
        service_account: ServiceAccount,
    ) -> Response:
        serializer = ServiceAccountUpdateSerializer(
            data=request.data,
            partial=True,
            context={"access": request.access, "organization": organization},
        )
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        data = cast(ServiceAccountUpdateRequestData, serializer.validated_data)

        try:
            with outbox_context(transaction.atomic(using=router.db_for_write(ServiceAccount))):
                service_account = ServiceAccount.objects.select_for_update().get(
                    id=service_account.id
                )
                if "name" in data:
                    service_account.name = data["name"]
                if "scopes" in data:
                    service_account.scope_list = data["scopes"]
                if "isActive" in data:
                    service_account.is_active = data["isActive"]
                if "projectIds" in data:
                    _replace_projects(service_account, data["projectIds"] or [])
                service_account.save()
        except ServiceAccount.DoesNotExist:
            # Deleted by another request after convert_args loaded it.
            raise ResourceDoesNotExist
        except IntegrityError:
            # The (organization_id, name) unique constraint is the duplicate name check.
            return Response({"detail": {"name": [DUPLICATE_NAME_ERROR]}}, status=400)

        response = serialize(service_account, request.user, serializer=ServiceAccountSerializer())
        self.create_audit_entry(
            request,
            organization=organization,
            target_object=service_account.id,
            event=audit_log.get_event_id("SERVICE_ACCOUNT_EDIT"),
            data=_audit_log_data(response),
        )
        return Response(response)

    @extend_schema(
        operation_id="Delete a Service Account",
        parameters=[GlobalParams.ORG_ID_OR_SLUG, SERVICE_ACCOUNT_ID],
        responses={
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def delete(
        self,
        request: Request,
        organization_context: RpcUserOrganizationContext,
        organization: RpcOrganization,
        service_account: ServiceAccount,
    ) -> Response:
        audit_data = _audit_log_data(
            serialize(service_account, request.user, serializer=ServiceAccountSerializer())
        )
        service_account_id = service_account.id
        # The tombstone cascade removes the cell replica. The project rows go with the account.
        service_account.delete()
        self.create_audit_entry(
            request,
            organization=organization,
            target_object=service_account_id,
            event=audit_log.get_event_id("SERVICE_ACCOUNT_REMOVE"),
            data=audit_data,
        )
        return Response(status=204)
