from __future__ import annotations

from typing import Any

from django.conf import settings
from django.db import router, transaction
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import Endpoint, cell_silo_endpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.permissions import ScopedPermission
from sentry.auth.principal import (
    require_service_account_principal,
    require_user_principal,
)
from sentry.auth.services.service_account import service_account_service
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team, TeamStatus
from sentry.roles import organization_roles
from sentry.viewer_context import get_viewer_context

FEATURE = "organizations:service-account-principals-poc"
DEFAULT_TOKEN_SCOPES = ["org:read"]


class ServiceAccountPrincipalPocPermission(ScopedPermission):
    scope_map = {
        "GET": ["org:read"],
        "POST": ["member:admin"],
    }


class ServiceAccountPrincipalPocSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=256)
    role = serializers.CharField(required=False, default=organization_roles.get_default().id)
    teams = serializers.ListField(
        child=serializers.CharField(), required=False, default=list, allow_empty=True
    )
    scopes = serializers.ListField(
        child=serializers.ChoiceField(choices=sorted(settings.SENTRY_SCOPES)),
        required=False,
        default=lambda: list(DEFAULT_TOKEN_SCOPES),
        allow_empty=False,
    )
    expiresAt = serializers.DateTimeField(required=False, allow_null=True, default=None)

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("The name cannot be blank.")
        return value

    def validate_role(self, value: str) -> str:
        try:
            role = organization_roles.get(value)
        except KeyError:
            raise serializers.ValidationError("Invalid organization role.")
        if role.is_retired:
            raise serializers.ValidationError("Invalid organization role.")
        return value

    def validate_teams(self, values: list[str]) -> list[Team]:
        organization: Organization = self.context["organization"]
        teams = list(
            Team.objects.filter(
                organization=organization,
                status=TeamStatus.ACTIVE,
                slug__in=values,
            )
        )
        if len(teams) != len(set(values)):
            raise serializers.ValidationError("Invalid teams.")
        return teams

    def validate(self, attrs: dict[str, Any]) -> dict[str, Any]:
        role = organization_roles.get(attrs["role"])
        if attrs["teams"] and not role.is_team_roles_allowed:
            raise serializers.ValidationError(
                {"teams": "This organization role cannot have team assignments."}
            )
        attrs["scopes"] = sorted(set(attrs["scopes"]))
        return attrs


@cell_silo_endpoint
class OrganizationServiceAccountPrincipalPocEndpoint(Endpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "POST": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (ServiceAccountPrincipalPocPermission,)

    def convert_args(
        self,
        request: Request,
        *args: Any,
        **kwargs: Any,
    ) -> tuple[tuple[Any, ...], dict[str, Any]]:
        organization_id_or_slug = kwargs.pop("organization_id_or_slug", None)
        if organization_id_or_slug is None:
            raise ResourceDoesNotExist

        try:
            if str(organization_id_or_slug).isdecimal():
                organization = Organization.objects.get_from_cache(id=int(organization_id_or_slug))
            else:
                organization = Organization.objects.get_from_cache(slug=organization_id_or_slug)
        except Organization.DoesNotExist:
            raise ResourceDoesNotExist

        request._request.organization = organization
        kwargs["organization"] = organization
        return args, kwargs

    def _require_feature(self, request: Request, organization: Organization) -> None:
        if not features.has(FEATURE, organization, actor=request.user):
            raise ResourceDoesNotExist

    def get(self, request: Request, organization: Organization) -> Response:
        self._require_feature(request, organization)
        principal = require_service_account_principal(request)
        if principal.organization_id != organization.id:
            raise PermissionDenied("This service account belongs to another organization.")

        try:
            member = OrganizationMember.objects.get(
                organization=organization,
                service_account_id=principal.id,
            )
        except OrganizationMember.DoesNotExist:
            raise PermissionDenied("This service account is not an organization member.")

        token_scopes = set(request.auth.get_scopes()) if request.auth is not None else set()
        member_scopes = set(member.get_scopes())
        teams = list(member.get_teams().order_by("slug").values_list("slug", flat=True))
        viewer_context = get_viewer_context()

        return Response(
            {
                "identifier": principal.identifier,
                "principal": {
                    "type": principal.kind.value,
                    "id": str(principal.id),
                    "name": principal.display_name,
                },
                "member": {
                    "id": str(member.id),
                    "role": member.role,
                    "teams": teams,
                },
                "tokenScopes": sorted(token_scopes),
                "memberScopes": sorted(member_scopes),
                "effectiveScopes": sorted(token_scopes & member_scopes),
                "viewerContext": {
                    "actorIdentifier": (
                        viewer_context.actor_identifier if viewer_context is not None else None
                    ),
                    "userId": viewer_context.user_id if viewer_context is not None else None,
                },
            }
        )

    def post(self, request: Request, organization: Organization) -> Response:
        self._require_feature(request, organization)
        principal = require_user_principal(request)

        try:
            caller_member = OrganizationMember.objects.get(
                organization=organization,
                user_id=principal.id,
            )
        except OrganizationMember.DoesNotExist:
            raise PermissionDenied("You are not a member of this organization.")

        if "member:admin" not in caller_member.get_scopes():
            raise PermissionDenied("You cannot create service accounts.")

        serializer = ServiceAccountPrincipalPocSerializer(
            data=request.data,
            context={"organization": organization},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if not organization_roles.can_manage(caller_member.role, data["role"]):
            raise PermissionDenied("You cannot assign this organization role.")

        created = service_account_service.create(
            organization_id=organization.id,
            name=data["name"],
            scopes=data["scopes"],
            expires_at=data["expiresAt"],
        )
        if created is None:
            return Response(
                {"detail": "A service account with this name already exists."},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with transaction.atomic(using=router.db_for_write(OrganizationMember)):
                member = OrganizationMember.objects.create(
                    organization=organization,
                    service_account_id=created.account.id,
                    role=data["role"],
                )
                OrganizationMemberTeam.objects.bulk_create(
                    [
                        OrganizationMemberTeam(organizationmember=member, team=team)
                        for team in data["teams"]
                    ]
                )
        except Exception:
            service_account_service.delete(
                organization_id=organization.id,
                service_account_id=created.account.id,
            )
            raise

        return Response(
            {
                "identifier": f"service_account:{created.account.id}",
                "principal": {
                    "type": "service_account",
                    "id": str(created.account.id),
                    "name": created.account.name,
                },
                "member": {
                    "id": str(member.id),
                    "role": member.role,
                    "teams": sorted(team.slug for team in data["teams"]),
                },
                "token": created.token.token,
                "tokenId": str(created.token.id),
                "tokenScopes": data["scopes"],
            },
            status=status.HTTP_201_CREATED,
        )
