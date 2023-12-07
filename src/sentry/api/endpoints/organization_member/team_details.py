from typing import Any, Mapping, MutableMapping

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import serializers, status
from rest_framework.exceptions import ValidationError
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features, roles
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationMemberEndpoint
from sentry.api.bases.organization import OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import Serializer, serialize
from sentry.api.serializers.models.team import BaseTeamSerializer, TeamSerializer
from sentry.apidocs.constants import (
    RESPONSE_ACCEPTED,
    RESPONSE_BAD_REQUEST,
    RESPONSE_NO_CONTENT,
    RESPONSE_NOT_FOUND,
    RESPONSE_UNAUTHORIZED,
)
from sentry.apidocs.examples.team_examples import TeamExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.auth.access import Access
from sentry.auth.superuser import is_active_superuser
from sentry.models.organization import Organization
from sentry.models.organizationaccessrequest import OrganizationAccessRequest
from sentry.models.organizationmember import OrganizationMember
from sentry.models.organizationmemberteam import OrganizationMemberTeam
from sentry.models.team import Team
from sentry.roles import team_roles
from sentry.roles.manager import TeamRole
from sentry.utils import metrics
from sentry.utils.json import JSONData

from . import can_admin_team, can_set_team_role

ERR_INSUFFICIENT_ROLE = "You do not have permission to edit that user's membership."


class OrganizationMemberTeamSerializer(serializers.Serializer):
    isActive = serializers.BooleanField()
    teamRole = serializers.CharField(allow_null=True, allow_blank=True)


class OrganizationMemberTeamDetailsSerializer(Serializer):
    def serialize(
        self, obj: OrganizationMemberTeam, attrs: Mapping[Any, Any], user: Any, **kwargs: Any
    ) -> MutableMapping[str, JSONData]:
        return {
            "isActive": obj.is_active,
            "teamRole": obj.role,
        }


class OrganizationTeamMemberPermission(OrganizationPermission):
    scope_map = {
        "GET": [
            "org:read",
            "org:write",
            "org:admin",
            "member:read",
            "member:write",
            "member:admin",
        ],
        "POST": ["org:read", "org:write", "team:write"],
        "PUT": [
            "org:read",
            "org:write",
            "org:admin",
            "member:read",
            "member:write",
            "member:admin",
        ],
        "DELETE": ["org:read", "org:write", "org:admin", "team:admin"],
    }


def _has_elevated_scope(access: Access) -> bool:
    """
    Validate that the token has more than just org:read
    """
    return access.has_scope("org:write") or access.has_scope("team:write")


def _is_org_owner_or_manager(access: Access) -> bool:
    roles = access.get_organization_roles()
    # only org owners and managers have org:write scope
    return any("org:write" in role.scopes for role in roles)


@extend_schema(tags=["Teams"])
@region_silo_endpoint
class OrganizationMemberTeamDetailsEndpoint(OrganizationMemberEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PUBLIC,
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
        "POST": ApiPublishStatus.PUBLIC,
    }
    owner = ApiOwner.ENTERPRISE
    permission_classes = (OrganizationTeamMemberPermission,)

    def _can_create_team_member(self, request: Request, team: Team) -> bool:
        """
        User can join or add a member to a team:

        * If they are an active superuser
        * If they are a team admin or have global write access
        * If the open membership organization setting is enabled
        """
        access = request.access

        # When open membership is disabled, we need to check if the token has elevated permissions
        # in order to ensure integration tokens with only "org:read" scope cannot add members. This check
        # comes first because access.has_global_access is True for all integration tokens
        if access.is_integration_token and not access.has_open_membership:
            return _has_elevated_scope(access)
        return access.has_global_access or can_admin_team(access, team)

    def _can_delete(
        self,
        request: Request,
        member: OrganizationMember,
        team: Team,
    ) -> bool:
        """
        User can remove a member from a team:

        * If they are an active superuser
        * If they are removing their own membership
        * If they are a team admin or have global write access
        """
        if is_active_superuser(request):
            return True

        if not request.user.is_authenticated:
            return False

        if request.user.id == member.user_id:
            return True

        # There is an edge case where org owners/managers cannot remove a member from a team they
        # are not part of using team:admin. We cannot explicitly check for team:admin b/c org admins
        # also have it but are only allowed to remove members from teams they are on.
        if _is_org_owner_or_manager(request.access):
            return True

        return can_admin_team(request.access, team)

    def _create_access_request(
        self, request: Request, team: Team, member: OrganizationMember
    ) -> None:
        omt, created = OrganizationAccessRequest.objects.get_or_create(team=team, member=member)

        if not created:
            return

        requester = request.user.id if request.user.id != member.user_id else None
        if requester:
            omt.update(requester_id=requester)

        omt.send_request_email()

    def get(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
        team_slug: str,
    ) -> Response:
        omt = None
        try:
            omt = OrganizationMemberTeam.objects.get(
                team__slug=team_slug, organizationmember=member
            )
        except OrganizationMemberTeam.DoesNotExist:
            raise ResourceDoesNotExist

        return Response(
            serialize(omt, request.user, OrganizationMemberTeamDetailsSerializer()), status=200
        )

    @extend_schema(
        operation_id="Add an Organization Member to a Team",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.member_id("The ID of the organization member to add to the team"),
            GlobalParams.TEAM_SLUG,
        ],
        request=None,
        responses={
            201: BaseTeamSerializer,
            202: RESPONSE_ACCEPTED,
            204: RESPONSE_NO_CONTENT,
            401: RESPONSE_UNAUTHORIZED,
            403: OpenApiResponse(
                description="This team is managed through your organization's identity provider"
            ),
            404: RESPONSE_NOT_FOUND,
        },
        examples=TeamExamples.ADD_TO_TEAM,
    )
    def post(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
        team_slug: str,
    ) -> Response:
        # NOTE: Required to use HTML for table b/c this markdown version doesn't support colspan.
        r"""
        This request can return various success codes depending on the context of the team:
        - **`201`**: The member has been successfully added.
        - **`202`**: The member needs permission to join the team and an access request
        has been generated.
        - **`204`**: The member is already on the team.

        If the team is provisioned through an identity provider, the member cannot join the
        team through Sentry.

        Note the permission scopes vary depending on the organization setting `"Open Membership"`
        and the type of authorization token. The following table outlines the accepted scopes.
        <table style="width: 100%;">
        <thead>
            <tr>
            <th style="width: 33%;"></th>
            <th colspan="2" style="text-align: center; font-weight: bold; width: 33%;">Open Membership</th>
            </tr>
        </thead>
        <tbody>
            <tr>
            <td style="width: 34%;"></td>
            <td style="text-align: center; font-weight: bold; width: 33%;">On</td>
            <td style="text-align: center; font-weight: bold; width: 33%;">Off</td>
            </tr>
            <tr>
            <td style="text-align: center; font-weight: bold; vertical-align: middle;"><a
            href="https://docs.sentry.io/api/auth/#auth-tokens">Org Auth Token</a></td>
            <td style="text-align: left; width: 33%;">
                <ul style="list-style-type: none; padding-left: 0;">
                <li><strong style="color: #9c5f99;">&bull; org:read</strong></li>
                </ul>
            </td>
            <td style="text-align: left; width: 33%;">
                <ul style="list-style-type: none; padding-left: 0;">
                <li><strong style="color: #9c5f99;">&bull; org:write</strong></li>
                <li><strong style="color: #9c5f99;">&bull; team:write</strong></li>
                </ul>
            </td>
            </tr>
            <tr>
            <td style="text-align: center; font-weight: bold; vertical-align: middle;"><a
            href="https://docs.sentry.io/api/auth/#user-authentication-tokens">User Auth Token</a></td>
            <td style="text-align: left; width: 33%;">
                <ul style="list-style-type: none; padding-left: 0;">
                <li><strong style="color: #9c5f99;">&bull; org:read</strong></li>
                </ul>
            </td>
            <td style="text-align: left; width: 33%;">
                <ul style="list-style-type: none; padding-left: 0;">
                <li><strong style="color: #9c5f99;">&bull; org:read*</strong></li>
                <li><strong style="color: #9c5f99;">&bull; org:write</strong></li>
                <li><strong style="color: #9c5f99;">&bull; org:read +</strong></li>
                <li><strong style="color: #9c5f99;">&nbsp; &nbsp;team:write**</strong></li>
                </ul>
            </td>
            </tr>
        </tbody>
        </table>


        *Organization members are restricted to this scope. When sending a request, it will always
        return a 202 and request an invite to the team.


        \*\*Team Admins must have both **`org:read`** and **`team:write`** scopes in their user
        authorization token to add members to their teams.
        """
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)

        try:
            team = Team.objects.get(organization=organization, slug=team_slug)
        except Team.DoesNotExist:
            raise ResourceDoesNotExist

        if OrganizationMemberTeam.objects.filter(team=team, organizationmember=member).exists():
            return Response(status=204)

        if team.idp_provisioned:
            return Response(
                {"detail": "This team is managed through your organization's identity provider."},
                status=403,
            )

        if not self._can_create_team_member(request, team):
            self._create_access_request(request, team, member)
            return Response(status=202)

        omt = OrganizationMemberTeam.objects.create(team=team, organizationmember=member)

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=omt.id,
            target_user_id=member.user_id,
            event=audit_log.get_event_id("MEMBER_JOIN_TEAM"),
            data=omt.get_audit_log_data(),
        )

        return Response(serialize(team, request.user, TeamSerializer()), status=201)

    def put(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
        team_slug: str,
    ) -> Response:
        try:
            team = Team.objects.get(organization=organization, slug=team_slug)
        except Team.DoesNotExist:
            raise ResourceDoesNotExist

        try:
            omt = OrganizationMemberTeam.objects.get(team=team, organizationmember=member)
        except OrganizationMemberTeam.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = OrganizationMemberTeamSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            raise ValidationError(serializer.errors)
        result = serializer.validated_data

        if "teamRole" in result and features.has("organizations:team-roles", organization):
            new_role_id = result["teamRole"]
            try:
                new_role = team_roles.get(new_role_id)
            except KeyError:
                return Response(status=400)

            if not can_set_team_role(request, team, new_role):
                return Response({"detail": ERR_INSUFFICIENT_ROLE}, status=400)

            self._change_team_member_role(omt, new_role)

        return Response(
            serialize(omt, request.user, OrganizationMemberTeamDetailsSerializer()), status=200
        )

    @staticmethod
    def _change_team_member_role(
        team_membership: OrganizationMemberTeam, team_role: TeamRole
    ) -> None:
        """Modify a member's team-level role."""
        minimum_team_role = roles.get_minimum_team_role(team_membership.organizationmember.role)
        if team_role.priority > minimum_team_role.priority:
            applying_minimum = False
            team_membership.update(role=team_role.id)
        else:
            # The new team role is redundant to the role that this member would
            # receive as their minimum team role anyway. This makes it effectively
            # invisible in the UI, and it would be surprising if it were suddenly
            # left over after the user's org-level role is demoted. So, write a null
            # value to the database and let the minimum team role take over.
            applying_minimum = True
            team_membership.update(role=None)

        metrics.incr(
            "team_roles.assign",
            tags={"target_team_role": team_role.id, "applying_minimum": str(applying_minimum)},
        )

    @extend_schema(
        operation_id="Delete an Organization Member from a Team",
        parameters=[
            GlobalParams.ORG_SLUG,
            GlobalParams.member_id("The ID of the organization member to delete from the team"),
            GlobalParams.TEAM_SLUG,
        ],
        request=None,
        responses={
            200: BaseTeamSerializer,
            400: RESPONSE_BAD_REQUEST,
            403: OpenApiResponse(
                description="This team is managed through your organization's identity provider"
            ),
            404: RESPONSE_NOT_FOUND,
        },
        examples=TeamExamples.DELETE_FROM_TEAM,
    )
    def delete(
        self,
        request: Request,
        organization: Organization,
        member: OrganizationMember,
        team_slug: str,
    ) -> Response:
        r"""
        Delete an organization member from a team.

        Note the permission scopes vary depending on the type of authorization token. The following
        table outlines the accepted scopes.
        <table style="width: 100%;">
            <tr style="width: 50%;">
                <td style="width: 50%; text-align: center; font-weight: bold; vertical-align: middle;"><a href="https://docs.sentry.io/api/auth/#auth-tokens">Org Auth Token</a></td>
                <td style="width: 50%; text-align: left;">
                    <ul style="list-style-type: none; padding-left: 0;">
                        <li><strong style="color: #9c5f99;">&bull; org:write</strong></li>
                        <li><strong style="color: #9c5f99;">&bull; org:admin</strong></li>
                        <li><strong style="color: #9c5f99;">&bull; team:admin</strong></li>
                    </ul>
                </td>
            </tr>
            <tr style="width: 50%;">
                <td style="width: 50%; text-align: center; font-weight: bold; vertical-align: middle;"><a href="https://docs.sentry.io/api/auth/#user-authentication-tokens">User Auth Token</a></td>
                <td style="width: 50%; text-align: left;">
                    <ul style="list-style-type: none; padding-left: 0;">
                        <li><strong style="color: #9c5f99;">&bull; org:read*</strong></li>
                        <li><strong style="color: #9c5f99;">&bull; org:write</strong></li>
                        <li><strong style="color: #9c5f99;">&bull; org:admin</strong></li>
                        <li><strong style="color: #9c5f99;">&bull; team:admin</strong></li>
                        <li><strong style="color: #9c5f99;">&bull; org:read + team:admin**</strong></li>
                    </ul>
                </td>
            </tr>
        </table>


        \***`org:read`** can only be used to remove yourself from the teams you are a member of.


        \*\*Team Admins must have both **`org:read`** and **`team:admin`** scopes in their user
        authorization token to delete members from their teams.
        """
        try:
            team = Team.objects.get(organization=organization, slug=team_slug)
        except Team.DoesNotExist:
            raise ResourceDoesNotExist

        if not self._can_delete(request, member, team):
            return Response({"detail": ERR_INSUFFICIENT_ROLE}, status=400)

        if team.idp_provisioned:
            return Response(
                {"detail": "This team is managed through your organization's identity provider."},
                status=403,
            )

        omt = None
        try:
            omt = OrganizationMemberTeam.objects.get(team=team, organizationmember=member)
        except OrganizationMemberTeam.DoesNotExist:
            pass

        else:
            self.create_audit_entry(
                request=request,
                organization=organization,
                target_object=omt.id,
                target_user_id=member.user_id,
                event=audit_log.get_event_id("MEMBER_LEAVE_TEAM"),
                data=omt.get_audit_log_data(),
            )
            omt.delete()

        return Response(serialize(team, request.user, TeamSerializer()), status=200)
