from django.conf import settings
from django.db import router, transaction
from django.db.models import F, Q
from drf_spectacular.utils import extend_schema, extend_schema_serializer
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features, ratelimits, roles
from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.bases.organizationmember import MemberAndStaffPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization_member import OrganizationMemberSerializer
from sentry.api.serializers.models.organization_member.response import OrganizationMemberResponse
from sentry.api.validators import AllowedEmailField
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND, RESPONSE_UNAUTHORIZED
from sentry.apidocs.examples.organization_member_examples import OrganizationMemberExamples
from sentry.apidocs.parameters import GlobalParams
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.auth.authenticators import available_authenticators
from sentry.integrations.models.external_actor import ExternalActor
from sentry.models.organizationmember import InviteStatus, OrganizationMember
from sentry.models.team import Team, TeamStatus
from sentry.roles import organization_roles, team_roles
from sentry.search.utils import tokenize_query
from sentry.signals import member_invited
from sentry.users.services.user.service import user_service
from sentry.utils import metrics

from . import get_allowed_org_roles, save_team_assignments

ERR_RATE_LIMITED = "You are being rate limited for too many invitations."

# Required to explicitly define roles w/ descriptions because OrganizationMemberSerializer
# has the wrong descriptions, includes deprecated admin, and excludes billing
ROLE_CHOICES = [
    ("billing", "Can manage payment and compliance details."),
    (
        "member",
        "Can view and act on events, as well as view most other data within the organization.",
    ),
    (
        "manager",
        """Has full management access to all teams and projects. Can also manage
        the organization's membership.""",
    ),
    (
        "owner",
        """Has unrestricted access to the organization, its data, and its
        settings. Can add, modify, and delete projects and members, as well as
        make billing and plan changes.""",
    ),
    (
        "admin",
        """Can edit global integrations, manage projects, and add/remove teams.
        They automatically assume the Team Admin role for teams they join.
        Note: This role can no longer be assigned in Business and Enterprise plans. Use `TeamRoles` instead.
        """,
    ),
]


class MemberConflictValidationError(serializers.ValidationError):
    pass


@extend_schema_serializer(
    deprecate_fields=["role", "teams"], exclude_fields=["regenerate", "role", "teams"]
)
class OrganizationMemberRequestSerializer(serializers.Serializer):
    email = AllowedEmailField(
        max_length=75, required=True, help_text="The email address to send the invitation to."
    )
    role = serializers.ChoiceField(
        choices=roles.get_choices(), default=organization_roles.get_default().id
    )  # deprecated, use orgRole
    orgRole = serializers.ChoiceField(
        choices=ROLE_CHOICES,
        default=organization_roles.get_default().id,
        required=False,
        help_text="The organization-level role of the new member. Roles include:",  # choices will follow in the docs
    )
    teams = serializers.ListField(
        required=False, allow_null=False, default=[]
    )  # deprecated, use teamRoles
    teamRoles = serializers.ListField(
        required=False,
        allow_null=True,
        default=[],
        child=serializers.JSONField(),
        help_text="""The team and team-roles assigned to the member. Team roles can be either:
        - `contributor` - Can view and act on issues. Depending on organization settings, they can also add team members.
        - `admin` - Has full management access to their team's membership and projects.""",
    )
    sendInvite = serializers.BooleanField(
        required=False,
        default=True,
        write_only=True,
        help_text="Whether or not to send an invite notification through email. Defaults to True.",
    )
    reinvite = serializers.BooleanField(
        required=False,
        help_text="Whether or not to re-invite a user who has already been invited to the organization. Defaults to True.",
    )
    regenerate = serializers.BooleanField(required=False)

    def validate_email(self, email):
        users = user_service.get_many_by_email(
            emails=[email],
            is_active=True,
            organization_id=self.context["organization"].id,
            is_verified=False,
        )
        queryset = OrganizationMember.objects.filter(
            Q(email=email) | Q(user_id__in=[u.id for u in users]),
            organization=self.context["organization"],
        )

        if queryset.filter(invite_status=InviteStatus.APPROVED.value).exists():
            raise MemberConflictValidationError("The user %s is already a member" % email)

        if not self.context.get("allow_existing_invite_request"):
            if queryset.filter(
                Q(invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value)
                | Q(invite_status=InviteStatus.REQUESTED_TO_JOIN.value)
            ).exists():
                raise MemberConflictValidationError(
                    "There is an existing invite request for %s" % email
                )
        return email

    def validate_role(self, role):
        return self.validate_orgRole(role)

    def validate_orgRole(self, role):
        if role == "billing" and features.has(
            "organizations:invite-billing", self.context["organization"]
        ):
            return role
        role_obj = next((r for r in self.context["allowed_roles"] if r.id == role), None)
        if role_obj is None:
            raise serializers.ValidationError(
                "You do not have permission to set that org-level role"
            )
        if not self.context.get("allow_retired_roles", True) and role_obj.is_retired:
            raise serializers.ValidationError(
                f"The role '{role}' is deprecated and may no longer be assigned."
            )
        return role

    def validate_teams(self, teams):
        valid_teams = list(
            Team.objects.filter(
                organization=self.context["organization"], status=TeamStatus.ACTIVE, slug__in=teams
            )
        )

        if len(valid_teams) != len(teams):
            raise serializers.ValidationError("Invalid teams")

        return valid_teams

    def validate_teamRoles(self, teamRoles) -> list[tuple[Team, str]]:
        roles = {item["role"] for item in teamRoles}
        valid_roles = [r.id for r in team_roles.get_all()] + [None]
        if roles.difference(valid_roles):
            raise serializers.ValidationError("Invalid team-role")
        team_slugs = [item["teamSlug"] for item in teamRoles]
        valid_teams = self.validate_teams(team_slugs)

        # Avoids O(n * n) search
        team_role_map = {item["teamSlug"]: item["role"] for item in teamRoles}
        # TODO(dlee): Check if they have permissions to assign team role for each team
        valid_team_roles = [(team, team_role_map[team.slug]) for team in valid_teams]

        return valid_team_roles


@region_silo_endpoint
@extend_schema(tags=["Organizations"])
class OrganizationMemberIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PUBLIC,
        "POST": ApiPublishStatus.PUBLIC,
    }
    permission_classes = (MemberAndStaffPermission,)
    owner = ApiOwner.ENTERPRISE

    @extend_schema(
        operation_id="List an Organization's Members",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        responses={
            200: inline_sentry_response_serializer(
                "ListOrganizationMemberResponse", list[OrganizationMemberResponse]
            ),
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=OrganizationMemberExamples.LIST_ORG_MEMBERS,
    )
    def get(self, request: Request, organization) -> Response:
        """
        List all organization members.

        Response includes pending invites that are approved by organization owners or managers but waiting to be accepted by the invitee.
        """
        queryset = OrganizationMember.objects.filter(
            Q(user_is_active=True, user_id__isnull=False) | Q(user_id__isnull=True),
            organization=organization,
            invite_status=InviteStatus.APPROVED.value,
        ).order_by("id")

        query = request.GET.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "email":
                    email_user_ids = user_service.get_many_by_email(
                        emails=value, organization_id=organization.id, is_verified=False
                    )
                    queryset = queryset.filter(
                        Q(email__in=value) | Q(user_id__in=[u.id for u in email_user_ids])
                    )

                elif key == "id":
                    queryset = queryset.filter(id__in=value)

                elif key == "user.id":
                    queryset = queryset.filter(user_id__in=value)

                elif key == "scope":
                    queryset = queryset.filter(role__in=[r.id for r in roles.with_any_scope(value)])

                elif key == "role":
                    queryset = queryset.filter(role__in=value)

                elif key == "isInvited":
                    isInvited = "true" in value
                    queryset = queryset.filter(user_id__isnull=isInvited)

                elif key == "ssoLinked":
                    ssoFlag = OrganizationMember.flags["sso:linked"]
                    ssoLinked = "true" in value
                    if ssoLinked:
                        queryset = queryset.filter(flags=F("flags").bitor(ssoFlag))
                    else:
                        queryset = queryset.filter(flags=F("flags").bitand(~ssoFlag))

                elif key == "has2fa":
                    has2fa = "true" in value
                    if has2fa:
                        types = [a.type for a in available_authenticators(ignore_backup=True)]
                        has2fa_user_ids = user_service.get_many_ids(
                            filter=dict(organization_id=organization.id, authenticator_types=types)
                        )
                        queryset = queryset.filter(user_id__in=has2fa_user_ids).distinct()
                    else:
                        has2fa_user_ids = user_service.get_many_ids(
                            filter=dict(organization_id=organization.id, authenticator_types=None)
                        )
                        queryset = queryset.filter(user_id__in=has2fa_user_ids).distinct()
                elif key == "hasExternalUsers":
                    externalactor_user_ids = ExternalActor.objects.filter(
                        organization=organization,
                    ).values_list("user_id", flat=True)

                    hasExternalUsers = "true" in value
                    if hasExternalUsers:
                        queryset = queryset.filter(user_id__in=externalactor_user_ids)
                    else:
                        queryset = queryset.exclude(user_id__in=externalactor_user_ids)
                elif key == "query":
                    value = " ".join(value)
                    query_user_ids = user_service.get_many_ids(
                        filter=dict(query=value, organization_id=organization.id)
                    )
                    queryset = queryset.filter(
                        Q(user_id__in=query_user_ids) | Q(email__icontains=value)
                    )
                else:
                    queryset = queryset.none()

        expand = request.GET.getlist("expand", [])

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(
                x,
                request.user,
                serializer=OrganizationMemberSerializer(expand=expand),
            ),
            paginator_cls=OffsetPaginator,
        )

    @extend_schema(
        operation_id="Add a Member to an Organization",
        parameters=[
            GlobalParams.ORG_ID_OR_SLUG,
        ],
        request=OrganizationMemberRequestSerializer,
        responses={
            201: OrganizationMemberSerializer,
            401: RESPONSE_UNAUTHORIZED,
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
        examples=OrganizationMemberExamples.CREATE_ORG_MEMBER,
    )
    def post(self, request: Request, organization) -> Response:
        """
        Add or invite a member to an organization.
        """
        assigned_org_role = request.data.get("orgRole") or request.data.get("role")
        billing_bypass = assigned_org_role == "billing" and features.has(
            "organizations:invite-billing", organization
        )
        if not billing_bypass and not features.has(
            "organizations:invite-members", organization, actor=request.user
        ):
            return Response(
                {"organization": "Your organization is not allowed to invite members"}, status=403
            )

        allowed_roles = get_allowed_org_roles(request, organization, creating_org_invite=True)

        # We allow requests from integration tokens to invite new members as the member role only
        if not allowed_roles and request.access.is_integration_token:
            # Error if the assigned role is not a member
            if assigned_org_role != "member":
                raise serializers.ValidationError(
                    "Integration tokens are restricted to inviting new members with the member role only."
                )
            allowed_roles = [organization_roles.get("member")]

        serializer = OrganizationMemberRequestSerializer(
            data=request.data,
            context={
                "organization": organization,
                "allowed_roles": allowed_roles,
                "allow_existing_invite_request": True,
                "allow_retired_roles": not features.has("organizations:team-roles", organization),
            },
        )

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.validated_data

        if ratelimits.for_organization_member_invite(
            organization=organization,
            email=result["email"],
            user=request.user,
            auth=request.auth,
        ):
            metrics.incr(
                "member-invite.attempt",
                instance="rate_limited",
                skip_internal=True,
                sample_rate=1.0,
            )
            return Response({"detail": ERR_RATE_LIMITED}, status=429)

        is_member = not request.access.has_scope("member:admin") and (
            request.access.has_scope("member:invite")
        )
        disable_invites_to_other_teams = (
            not organization.flags.allow_joinleave and not organization.flags.disable_member_invite
        )
        has_team_roles = "teamRoles" in result and bool(result["teamRoles"])

        # members can only invite members to teams they are not in if
        # disable_member_invite = False and allow_joinleave = True
        if is_member and disable_invites_to_other_teams and has_team_roles:
            requester_teams = set(
                OrganizationMember.objects.filter(
                    organization=organization,
                    user_id=request.user.id,
                    user_is_active=True,
                ).values_list("teams__slug", flat=True)
            )
            team_slugs = [team.slug for team, _ in result.get("teamRoles")]
            if not requester_teams.issuperset(team_slugs):
                return Response(
                    {"detail": "You cannot assign members to teams you are not a member of."},
                    status=400,
                )

        if (
            ("teamRoles" in result and result["teamRoles"])
            or ("teams" in result and result["teams"])
        ) and not organization_roles.get(assigned_org_role).is_team_roles_allowed:
            return Response(
                {
                    "email": f"The user with a '{assigned_org_role}' role cannot have team-level permissions."
                },
                status=400,
            )

        with transaction.atomic(router.db_for_write(OrganizationMember)):
            # remove any invitation requests for this email before inviting
            existing_invite = OrganizationMember.objects.filter(
                Q(invite_status=InviteStatus.REQUESTED_TO_BE_INVITED.value)
                | Q(invite_status=InviteStatus.REQUESTED_TO_JOIN.value),
                email=result["email"],
                organization=organization,
            )
            for om in existing_invite:
                om.delete()

            om = OrganizationMember(
                organization=organization,
                email=result["email"],
                role=result["role"],
                inviter_id=request.user.id,
            )

            if settings.SENTRY_ENABLE_INVITES:
                om.token = om.generate_token()
            om.save()

        # Do not set team-roles when inviting members
        if "teamRoles" in result or "teams" in result:
            teams = (
                [team for team, _ in result.get("teamRoles")]
                if "teamRoles" in result and result["teamRoles"]
                else result.get("teams")
            )
            save_team_assignments(om, teams)

        if settings.SENTRY_ENABLE_INVITES and result.get("sendInvite"):
            referrer = request.query_params.get("referrer")
            om.send_invite_email(referrer)
            member_invited.send_robust(
                member=om, user=request.user, sender=self, referrer=request.data.get("referrer")
            )

        self.create_audit_entry(
            request=request,
            organization_id=organization.id,
            target_object=om.id,
            data=om.get_audit_log_data(),
            event=(
                audit_log.get_event_id("MEMBER_INVITE")
                if settings.SENTRY_ENABLE_INVITES
                else audit_log.get_event_id("MEMBER_ADD")
            ),
        )

        return Response(serialize(om), status=201)
