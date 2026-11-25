"""Service account management APIs.

These run in control, next to the `ServiceAccount` table. The viewer-context endpoint
runs in the cell and reads the account's `ServiceAccountReplica`.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any, NotRequired, TypedDict

from django.db import IntegrityError, router, transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features, roles
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
from sentry.auth.access import Access
from sentry.auth.principal import acting_user_id
from sentry.hybridcloud.models.outbox import (
    OutboxDatabaseError,
    OutboxFlushError,
    outbox_context,
)
from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcUserOrganizationContext,
    organization_service,
)
from sentry.service_accounts.audit import token_audit_log_data
from sentry.service_accounts.models import (
    GRANTABLE_SCOPES,
    MAX_NAME_LENGTH,
    ServiceAccount,
    ServiceAccountOwnerKind,
    ServiceAccountProject,
    ServiceAccountToken,
)

logger = logging.getLogger(__name__)

FEATURE_FLAG = "organizations:service-accounts"
MAX_PROJECT_IDS_PER_REQUEST = 1000

DUPLICATE_NAME_ERROR = "A service account with this name already exists."
ALL_PROJECTS_WITH_PROJECTS_ERROR = (
    "A service account with access to all projects can't also list projects."
    " Set allProjects to false to choose projects."
)
ALL_PROJECTS_ROLE_ERROR = (
    "Only a role with access to all projects, such as Manager or Owner,"
    " can give a service account access to all projects."
)
NARROW_ALL_PROJECTS_ERROR = (
    "Only a caller with access to all projects can narrow a service account's projects."
)
ADD_SCOPES_HIDDEN_PROJECTS_ERROR = (
    "You can't add scopes to a service account that has projects you can't access."
)

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
    allProjects: bool
    # A `ServiceAccountOwnerKind`. Null when the owner is unknown.
    ownerKind: str | None
    dateCreated: datetime


class ServiceAccountCreateRequestData(TypedDict):
    name: str
    scopes: list[str]
    projectIds: NotRequired[list[int] | None]
    allProjects: NotRequired[bool]


class ServiceAccountUpdateRequestData(TypedDict, total=False):
    name: str
    scopes: list[str]
    projectIds: list[int] | None
    allProjects: bool


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
            "allProjects": obj.all_projects,
            "ownerKind": obj.owner_kind,
            "dateCreated": obj.date_added,
        }


def _audit_log_data(response: ServiceAccountResponse) -> dict[str, Any]:
    return {
        "name": response["name"],
        "scopes": response["scopes"],
        "project_ids": response["projectIds"],
        "all_projects": response["allProjects"],
    }


def _check_can_grant_all_projects(request: Request) -> None:
    # Callers without a role, like org API keys and superusers who aren't members, are
    # refused too, since nothing shows they can reach every project themselves.
    role = request.access.role
    if role is None or not roles.get(role).is_global:
        raise PermissionDenied(ALL_PROJECTS_ROLE_ERROR)


def hidden_project_ids(access: Access, service_account: ServiceAccount) -> set[int]:
    """The account's linked projects the caller can't access. Empty for all-projects accounts."""
    if access.has_global_access:
        return set()
    linked = ServiceAccountProject.objects.filter(service_account=service_account).values_list(
        "project_id", flat=True
    )
    return set(linked) - access.accessible_project_ids


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
            "Projects the service account can access. Must be empty when `allProjects` is true."
        ),
    )
    allProjects = serializers.BooleanField(
        required=False,
        help_text=(
            "Whether the service account can access every active project in the organization,"
            " including projects created later. Defaults to false. Setting it to true removes"
            " the account's listed projects and requires a role with access to all projects,"
            " such as Manager or Owner."
        ),
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

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        service_account: ServiceAccount | None = self.context.get("service_account")
        all_projects = attrs.get(
            "allProjects", service_account.all_projects if service_account else False
        )
        if all_projects and attrs.get("projectIds"):
            raise serializers.ValidationError({"projectIds": [ALL_PROJECTS_WITH_PROJECTS_ERROR]})
        return attrs


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
        "GET": ["service_account:read"],
        "POST": ["service_account:write"],
        "PUT": ["service_account:write"],
        "DELETE": ["service_account:write"],
    }


class OrganizationServiceAccountEndpointBase(ControlSiloOrganizationEndpoint):
    owner = ApiOwner.COMMUNITY
    permission_classes: tuple[type[BasePermission], ...] = (ServiceAccountPermission,)

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
            queryset=ServiceAccount.objects.filter(organization_id=organization.id, is_active=True),
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
        data: ServiceAccountCreateRequestData = serializer.validated_data
        all_projects = data.get("allProjects", False)
        if all_projects:
            _check_can_grant_all_projects(request)

        try:
            service_account = ServiceAccount.create_with_projects(
                organization_id=organization.id,
                name=data["name"],
                scope_list=data["scopes"],
                project_ids=data.get("projectIds") or (),
                all_projects=all_projects,
                created_by_id=acting_user_id(request.user),
                owner_kind=ServiceAccountOwnerKind.ORGANIZATION,
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


class ServiceAccountScopedEndpointBase(OrganizationServiceAccountEndpointBase):
    """Resolves `service_account_id` to an active account in the URL's organization."""

    def convert_args(
        self, request: Request, *args: Any, **kwargs: Any
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        args, kwargs = super().convert_args(request, *args, **kwargs)
        try:
            kwargs["service_account"] = ServiceAccount.objects.get(
                organization_id=kwargs["organization"].id,
                id=kwargs.pop("service_account_id"),
                is_active=True,
            )
        except ServiceAccount.DoesNotExist:
            raise ResourceDoesNotExist
        return args, kwargs


@control_silo_endpoint
class OrganizationServiceAccountDetailsEndpoint(ServiceAccountScopedEndpointBase):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }

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
            context={
                "access": request.access,
                "organization": organization,
                "service_account": service_account,
            },
        )
        if not serializer.is_valid():
            return Response({"detail": serializer.errors}, status=400)
        data: ServiceAccountUpdateRequestData = serializer.validated_data

        try:
            with outbox_context(transaction.atomic(using=router.db_for_write(ServiceAccount))):
                service_account = ServiceAccount.objects.select_for_update().get(
                    id=service_account.id, is_active=True
                )
                # Checked against the locked row, so the checks see the grants being changed.
                hidden = hidden_project_ids(request.access, service_account)
                if "name" in data:
                    service_account.name = data["name"]
                if "scopes" in data:
                    if hidden and set(data["scopes"]) - set(service_account.scope_list):
                        raise PermissionDenied(ADD_SCOPES_HIDDEN_PROJECTS_ERROR)
                    service_account.scope_list = data["scopes"]
                all_projects = data.get("allProjects", service_account.all_projects)
                if (
                    service_account.all_projects
                    and not all_projects
                    and not request.access.has_global_access
                ):
                    raise PermissionDenied(NARROW_ALL_PROJECTS_ERROR)
                service_account.all_projects = all_projects
                # Keeping all projects on an account also needs the role, even when the
                # request doesn't mention it.
                if service_account.all_projects:
                    _check_can_grant_all_projects(request)
                    service_account.replace_projects([])
                elif "projectIds" in data:
                    # A replace keeps the projects the caller can't see.
                    service_account.replace_projects({*(data["projectIds"] or []), *hidden})
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
        # Set only once the delete succeeds, so a flush failure is told apart from a failed
        # delete.
        deactivated_tokens: list[ServiceAccountToken] | None = None
        try:
            with transaction.atomic(using=router.db_for_write(ServiceAccount)):
                # Token create takes this lock too, so the list below is exactly the set of
                # tokens that deactivate() turns off.
                if (
                    ServiceAccount.objects.select_for_update().get_or_none(
                        id=service_account_id, is_active=True
                    )
                    is None
                ):
                    # Deleted by another request after convert_args loaded it.
                    raise ResourceDoesNotExist
                tokens = service_account.lock_active_tokens()
                service_account.deactivate()
                deactivated_tokens = tokens
        except (OutboxDatabaseError, OutboxFlushError):
            if deactivated_tokens is None:
                raise
            # The delete and its outboxes are committed, so it reaches the cell when the
            # outboxes drain. Failing here would skip the audit log, and a retry would 404.
            logger.warning(
                "service_accounts.delete.outbox-flush-failure",
                extra={
                    "service_account_id": service_account_id,
                    "organization_id": organization.id,
                },
                exc_info=True,
            )
        self.create_audit_entry(
            request,
            organization=organization,
            target_object=service_account_id,
            event=audit_log.get_event_id("SERVICE_ACCOUNT_REMOVE"),
            data=audit_data,
        )
        for token in deactivated_tokens:
            self.create_audit_entry(
                request,
                organization=organization,
                target_object=token.id,
                event=audit_log.get_event_id("SERVICE_ACCOUNT_TOKEN_REMOVE"),
                data=token_audit_log_data(service_account, token, account_deleted=True),
            )
        return Response(status=204)
