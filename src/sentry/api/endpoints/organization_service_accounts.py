from __future__ import annotations

from typing import Any

from django.conf import settings
from django.db import router, transaction
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.organization import OrganizationAdminPermission, OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import SequencePaginator
from sentry.auth.services.service_account import (
    RpcServiceAccountDetail,
    RpcServiceAccountToken,
    service_account_service,
)
from sentry.models.organization import Organization
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team, TeamStatus
from sentry.roles import organization_roles

FEATURE = "organizations:service-accounts"
DEFAULT_TOKEN_SCOPES = ["event:read", "org:read", "project:read"]


class ServiceAccountRequestSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=256)
    role = serializers.CharField(required=False, default=organization_roles.get_default().id)
    teams = serializers.ListField(
        child=serializers.CharField(), required=False, default=list, allow_empty=True
    )
    tokenName = serializers.CharField(max_length=255, required=False, default="Default token")
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
        if attrs["teams"] and role is not None and not role.is_team_roles_allowed:
            raise serializers.ValidationError(
                {"teams": "This organization role cannot have team assignments."}
            )
        attrs["scopes"] = sorted(set(attrs["scopes"]))
        return attrs


class ServiceAccountUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=256, required=False)
    isActive = serializers.BooleanField(required=False)
    role = serializers.CharField(required=False)
    teams = serializers.ListField(child=serializers.CharField(), required=False, allow_empty=True)

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


class ServiceAccountTokenRequestSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    scopes = serializers.ListField(
        child=serializers.ChoiceField(choices=sorted(settings.SENTRY_SCOPES)),
        allow_empty=False,
    )
    expiresAt = serializers.DateTimeField(required=False, allow_null=True, default=None)

    def validate_name(self, value: str) -> str:
        value = value.strip()
        if not value:
            raise serializers.ValidationError("The name cannot be blank.")
        return value

    def validate_scopes(self, values: list[str]) -> list[str]:
        return sorted(set(values))


def _serialize_token(token: RpcServiceAccountToken) -> dict[str, Any]:
    return {
        "id": str(token.id),
        "name": token.name,
        "scopes": token.scopes,
        "expiresAt": token.expires_at,
        "tokenLastCharacters": token.token_last_characters,
    }


def _serialize_account(
    detail: RpcServiceAccountDetail,
    member: OrganizationMember,
    team_slugs: list[str],
) -> dict[str, Any]:
    account = detail.account
    return {
        "id": str(account.id),
        "name": account.name,
        "isActive": account.is_active,
        "dateCreated": account.date_added,
        "dateUpdated": account.date_updated,
        "role": member.role,
        "teams": team_slugs,
        "tokens": [_serialize_token(token) for token in detail.tokens],
    }


class ServiceAccountEndpointMixin:
    def _require_feature(self, request: Request, organization: Organization) -> None:
        if not features.has(
            FEATURE,
            organization,
            actor=request.user,
            skip_experiment_exposure=True,
        ):
            raise ResourceDoesNotExist

    def _get_member(
        self, *, organization: Organization, service_account_id: int
    ) -> OrganizationMember:
        try:
            return OrganizationMember.objects.get(
                organization=organization, service_account_id=service_account_id
            )
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist


@cell_silo_endpoint
class OrganizationServiceAccountsEndpoint(ServiceAccountEndpointMixin, OrganizationEndpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {"GET": ApiPublishStatus.PRIVATE, "POST": ApiPublishStatus.PRIVATE}
    permission_classes = (OrganizationAdminPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        self._require_feature(request, organization)
        details = service_account_service.list_accounts(organization_id=organization.id)
        members = {
            member.service_account_id: member
            for member in OrganizationMember.objects.filter(
                organization=organization,
                service_account_id__in=[detail.account.id for detail in details],
            )
        }
        team_slugs_by_member: dict[int, list[str]] = {member.id: [] for member in members.values()}
        for member_id, team_slug in (
            OrganizationMemberTeam.objects.filter(
                organizationmember_id__in=team_slugs_by_member,
            )
            .order_by("team__slug")
            .values_list("organizationmember_id", "team__slug")
        ):
            team_slugs_by_member[member_id].append(team_slug)
        serialized = [
            _serialize_account(
                detail,
                members[detail.account.id],
                team_slugs_by_member[members[detail.account.id].id],
            )
            for detail in details
            if detail.account.id in members
        ]
        return self.paginate(
            request=request,
            paginator=SequencePaginator(enumerate(serialized)),
        )

    def post(self, request: Request, organization: Organization) -> Response:
        self._require_feature(request, organization)
        serializer = ServiceAccountRequestSerializer(
            data=request.data, context={"organization": organization}
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        created = service_account_service.create(
            organization_id=organization.id,
            name=data["name"],
            token_name=data["tokenName"],
            scopes=data["scopes"],
            expires_at=data["expiresAt"],
        )
        if created is None:
            return Response(
                {"name": ["A service account with this name already exists."]},
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
                organization_id=organization.id, service_account_id=created.account.id
            )
            raise

        detail = RpcServiceAccountDetail(account=created.account, tokens=[created.token_metadata])
        response = _serialize_account(detail, member, sorted(team.slug for team in data["teams"]))
        response["token"] = created.token
        return Response(response, status=status.HTTP_201_CREATED)


@cell_silo_endpoint
class OrganizationServiceAccountDetailsEndpoint(ServiceAccountEndpointMixin, OrganizationEndpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (OrganizationAdminPermission,)

    def _get(
        self, request: Request, organization: Organization, service_account_id: str
    ) -> tuple[RpcServiceAccountDetail, OrganizationMember]:
        self._require_feature(request, organization)
        try:
            account_id = int(service_account_id)
        except ValueError:
            raise ResourceDoesNotExist
        detail = service_account_service.get(
            organization_id=organization.id, service_account_id=account_id
        )
        if detail is None:
            raise ResourceDoesNotExist
        return detail, self._get_member(organization=organization, service_account_id=account_id)

    def get(
        self, request: Request, organization: Organization, service_account_id: str
    ) -> Response:
        detail, member = self._get(request, organization, service_account_id)
        return Response(
            _serialize_account(
                detail,
                member,
                list(member.teams.order_by("slug").values_list("slug", flat=True)),
            )
        )

    def put(
        self, request: Request, organization: Organization, service_account_id: str
    ) -> Response:
        detail, member = self._get(request, organization, service_account_id)
        serializer = ServiceAccountUpdateSerializer(
            data=request.data, context={"organization": organization}
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        role_id = data.get("role", member.role)
        teams = data.get("teams")
        role = organization_roles.get(role_id)
        has_teams = bool(teams) if teams is not None else member.teams.exists()
        if has_teams and role is not None and not role.is_team_roles_allowed:
            raise serializers.ValidationError(
                {"teams": "This organization role cannot have team assignments."}
            )

        updated = service_account_service.update(
            organization_id=organization.id,
            service_account_id=detail.account.id,
            name=data.get("name"),
            is_active=data.get("isActive"),
        )
        if updated is None:
            raise ResourceDoesNotExist

        with transaction.atomic(using=router.db_for_write(OrganizationMember)):
            if "role" in data:
                member.role = data["role"]
                member.save(update_fields=["role"])
            if teams is not None:
                OrganizationMemberTeam.objects.filter(organizationmember=member).delete()
                OrganizationMemberTeam.objects.bulk_create(
                    [OrganizationMemberTeam(organizationmember=member, team=team) for team in teams]
                )

        refreshed = service_account_service.get(
            organization_id=organization.id, service_account_id=detail.account.id
        )
        assert refreshed is not None
        return Response(
            _serialize_account(
                refreshed,
                member,
                list(member.teams.order_by("slug").values_list("slug", flat=True)),
            )
        )

    def delete(
        self, request: Request, organization: Organization, service_account_id: str
    ) -> Response:
        detail, member = self._get(request, organization, service_account_id)
        if not service_account_service.delete(
            organization_id=organization.id, service_account_id=detail.account.id
        ):
            raise ResourceDoesNotExist
        member.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@cell_silo_endpoint
class OrganizationServiceAccountTokensEndpoint(ServiceAccountEndpointMixin, OrganizationEndpoint):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {"POST": ApiPublishStatus.PRIVATE}
    permission_classes = (OrganizationAdminPermission,)

    def post(
        self, request: Request, organization: Organization, service_account_id: str
    ) -> Response:
        self._require_feature(request, organization)
        try:
            account_id = int(service_account_id)
        except ValueError:
            raise ResourceDoesNotExist
        self._get_member(organization=organization, service_account_id=account_id)
        serializer = ServiceAccountTokenRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        created = service_account_service.create_token(
            organization_id=organization.id,
            service_account_id=account_id,
            name=data["name"],
            scopes=data["scopes"],
            expires_at=data["expiresAt"],
        )
        if created is None:
            raise ResourceDoesNotExist
        response = _serialize_token(created.token_metadata)
        response["token"] = created.token
        return Response(response, status=status.HTTP_201_CREATED)


@cell_silo_endpoint
class OrganizationServiceAccountTokenDetailsEndpoint(
    ServiceAccountEndpointMixin, OrganizationEndpoint
):
    owner = ApiOwner.FOUNDATIONS
    publish_status = {"DELETE": ApiPublishStatus.PRIVATE}
    permission_classes = (OrganizationAdminPermission,)

    def delete(
        self,
        request: Request,
        organization: Organization,
        service_account_id: str,
        token_id: str,
    ) -> Response:
        self._require_feature(request, organization)
        try:
            account_id = int(service_account_id)
            parsed_token_id = int(token_id)
        except ValueError:
            raise ResourceDoesNotExist
        self._get_member(organization=organization, service_account_id=account_id)
        if not service_account_service.delete_token(
            organization_id=organization.id,
            service_account_id=account_id,
            token_id=parsed_token_id,
        ):
            raise ResourceDoesNotExist
        return Response(status=status.HTTP_204_NO_CONTENT)
