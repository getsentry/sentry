from typing import List, Tuple

from django.conf import settings
from django.db import transaction
from django.db.models import F, Q
from rest_framework import serializers
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import audit_log, features, ratelimits, roles
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.models import organization_member as organization_member_serializers
from sentry.api.serializers.rest_framework import ListField
from sentry.api.validators import AllowedEmailField
from sentry.models import ExternalActor, InviteStatus, OrganizationMember, Team, TeamStatus
from sentry.models.authenticator import available_authenticators
from sentry.roles import organization_roles, team_roles
from sentry.search.utils import tokenize_query
from sentry.signals import member_invited
from sentry.utils import metrics

from . import get_allowed_org_roles, save_team_assignments

ERR_RATE_LIMITED = "You are being rate limited for too many invitations."


class MemberPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "POST": ["member:write", "member:admin"],
        "PUT": ["member:write", "member:admin"],
        "DELETE": ["member:admin"],
    }


class MemberConflictValidationError(serializers.ValidationError):
    pass


class OrganizationMemberSerializer(serializers.Serializer):
    email = AllowedEmailField(max_length=75, required=True)
    role = serializers.ChoiceField(
        choices=roles.get_choices(), default=organization_roles.get_default().id
    )  # deprecated, use orgRole
    orgRole = serializers.ChoiceField(
        choices=roles.get_choices(), default=organization_roles.get_default().id
    )
    teams = ListField(required=False, allow_null=False, default=[])  # deprecated, use teamRoles
    teamRoles = ListField(required=False, allow_null=True, default=[])
    sendInvite = serializers.BooleanField(required=False, default=True, write_only=True)
    reinvite = serializers.BooleanField(required=False)
    regenerate = serializers.BooleanField(required=False)

    def validate_email(self, email):
        queryset = OrganizationMember.objects.filter(
            Q(email=email) | Q(user__email__iexact=email, user__is_active=True),
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
        if features.has("organizations:team-roles", self.context["organization"]):
            if role in {r.id for r in organization_roles.get_all() if r.is_retired}:
                raise serializers.ValidationError("This org-level role has been deprecated")

        if role not in {r.id for r in self.context["allowed_roles"]}:
            raise serializers.ValidationError(
                "You do not have permission to set that org-level role"
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

    def validate_teamRoles(self, teamRoles) -> List[Tuple[Team, str]]:
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
class OrganizationMemberIndexEndpoint(OrganizationEndpoint):
    permission_classes = (MemberPermission,)

    def get(self, request: Request, organization) -> Response:
        queryset = (
            OrganizationMember.objects.filter(
                Q(user__is_active=True) | Q(user__isnull=True),
                organization=organization,
                invite_status=InviteStatus.APPROVED.value,
            )
            # TODO(hybridcloud) Cross silo joins here.
            .select_related("user").order_by("email", "user__email")
        )

        query = request.GET.get("query")
        if query:
            tokens = tokenize_query(query)
            for key, value in tokens.items():
                if key == "email":
                    queryset = queryset.filter(
                        Q(email__in=value)
                        | Q(user__email__in=value)
                        | Q(user__emails__email__in=value)
                    )

                elif key == "id":
                    queryset = queryset.filter(id__in=value)

                elif key == "user.id":
                    queryset = queryset.filter(user__id__in=value)

                elif key == "scope":
                    queryset = queryset.filter(role__in=[r.id for r in roles.with_any_scope(value)])

                elif key == "role":
                    members_with_role = organization.get_members_with_org_roles(
                        roles=value, include_null_users=True
                    ).values_list("id", flat=True)
                    queryset = queryset.filter(id__in=members_with_role)

                elif key == "isInvited":
                    isInvited = "true" in value
                    queryset = queryset.filter(user__isnull=isInvited)

                elif key == "ssoLinked":
                    ssoFlag = OrganizationMember.flags["sso:linked"]
                    ssoLinked = "true" in value
                    if ssoLinked:
                        queryset = queryset.filter(flags=F("flags").bitor(ssoFlag))
                    else:
                        queryset = queryset.filter(flags=F("flags").bitand(~ssoFlag))

                elif key == "has2fa":
                    # TODO(hybridcloud) Cross silo joins here.
                    has2fa = "true" in value
                    if has2fa:
                        types = [a.type for a in available_authenticators(ignore_backup=True)]
                        queryset = queryset.filter(
                            user__authenticator__isnull=False, user__authenticator__type__in=types
                        ).distinct()
                    else:
                        queryset = queryset.filter(user__authenticator__isnull=True)
                elif key == "hasExternalUsers":
                    externalactor_user_ids = ExternalActor.objects.filter(
                        organization=organization,
                    ).values_list("actor__user_id", flat=True)

                    hasExternalUsers = "true" in value
                    if hasExternalUsers:
                        queryset = queryset.filter(user_id__in=externalactor_user_ids)
                    else:
                        queryset = queryset.exclude(user_id__in=externalactor_user_ids)
                elif key == "query":
                    value = " ".join(value)
                    # TODO(hybridcloud) Cross silo joins.
                    queryset = queryset.filter(
                        Q(email__icontains=value)
                        | Q(user__email__icontains=value)
                        | Q(user__name__icontains=value)
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
                serializer=organization_member_serializers.OrganizationMemberSerializer(
                    expand=expand
                ),
            ),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request: Request, organization) -> Response:
        """
        Add a Member to Organization
        ````````````````````````````

        Invite a member to the organization.

        :param string organization_slug: the slug of the organization the member will belong to
        :param string email: the email address to invite
        :param string role: the org-role of the new member
        :param array teams: the slugs of the teams the member should belong to.
        :param array teamRoles: the team and team-roles assigned to the member

        :auth: required
        """
        if not features.has("organizations:invite-members", organization, actor=request.user):
            return Response(
                {"organization": "Your organization is not allowed to invite members"}, status=403
            )

        allowed_roles = get_allowed_org_roles(request, organization)

        serializer = OrganizationMemberSerializer(
            data=request.data,
            context={
                "organization": organization,
                "allowed_roles": allowed_roles,
                "allow_existing_invite_request": True,
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

        region_outbox = None
        with transaction.atomic():
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
            region_outbox = om.save_outbox_for_create()
        if region_outbox:
            region_outbox.drain_shard(max_updates_to_drain=10)

        # Do not set team-roles when inviting members
        if "teamRoles" in result or "teams" in result:
            teams = (
                [team for team, _ in result.get("teamRoles")]
                if "teamRoles" in result and result["teamRoles"]
                else result.get("teams")
            )
            save_team_assignments(om, teams)

        if settings.SENTRY_ENABLE_INVITES and result.get("sendInvite"):
            om.send_invite_email()
            member_invited.send_robust(
                member=om, user=request.user, sender=self, referrer=request.data.get("referrer")
            )

        self.create_audit_entry(
            request=request,
            organization_id=organization.id,
            target_object=om.id,
            data=om.get_audit_log_data(),
            event=audit_log.get_event_id("MEMBER_INVITE")
            if settings.SENTRY_ENABLE_INVITES
            else audit_log.get_event_id("MEMBER_ADD"),
        )

        return Response(serialize(om), status=201)
