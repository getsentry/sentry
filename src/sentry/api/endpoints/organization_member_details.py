from __future__ import absolute_import

from django.db import transaction
from django.db.models import Q
from rest_framework import serializers
from rest_framework.response import Response

from sentry import roles
from sentry.api.bases.organization import OrganizationEndpoint, OrganizationPermission
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import (
    DetailedUserSerializer,
    serialize,
    RoleSerializer,
    OrganizationMemberWithTeamsSerializer,
)
from sentry.api.serializers.rest_framework import ListField
from sentry.auth.superuser import is_active_superuser
from sentry.models import (
    AuditLogEntryEvent,
    AuthIdentity,
    AuthProvider,
    InviteStatus,
    OrganizationMember,
    OrganizationMemberTeam,
    Team,
    TeamStatus,
)
from sentry.utils import metrics, ratelimits


ERR_NO_AUTH = "You cannot remove this member with an unauthenticated API request."
ERR_INSUFFICIENT_ROLE = "You cannot remove a member who has more access than you."
ERR_INSUFFICIENT_SCOPE = "You are missing the member:admin scope."
ERR_ONLY_OWNER = "You cannot remove the only remaining owner of the organization."
ERR_UNINVITABLE = "You cannot send an invitation to a user who is already a full member."
ERR_EXPIRED = "You cannot resend an expired invitation without regenerating the token."
ERR_RATE_LIMITED = "You are being rate limited for too many invitations."


def get_allowed_roles(request, organization, member=None):
    can_admin = request.access.has_scope("member:admin")

    allowed_roles = []
    if can_admin and not is_active_superuser(request):
        acting_member = member or OrganizationMember.objects.get(
            user=request.user, organization=organization
        )
        if member and roles.get(acting_member.role).priority < roles.get(member.role).priority:
            can_admin = False
        else:
            allowed_roles = [
                r for r in roles.get_all() if r.priority <= roles.get(acting_member.role).priority
            ]
            can_admin = bool(allowed_roles)
    elif is_active_superuser(request):
        allowed_roles = roles.get_all()
    return (can_admin, allowed_roles)


class OrganizationMemberSerializer(serializers.Serializer):
    reinvite = serializers.BooleanField()
    regenerate = serializers.BooleanField()
    role = serializers.ChoiceField(choices=roles.get_choices(), required=True)
    teams = ListField(required=False, allow_null=False)


class RelaxedMemberPermission(OrganizationPermission):
    scope_map = {
        "GET": ["member:read", "member:write", "member:admin"],
        "POST": ["member:write", "member:admin"],
        "PUT": ["member:write", "member:admin"],
        # DELETE checks for role comparison as you can either remove a member
        # with a lower access role, or yourself, without having the req. scope
        "DELETE": ["member:read", "member:write", "member:admin"],
    }


class OrganizationMemberDetailsEndpoint(OrganizationEndpoint):
    permission_classes = [RelaxedMemberPermission]

    def _get_member(self, request, organization, member_id):
        if member_id == "me":
            queryset = OrganizationMember.objects.filter(
                organization=organization, user__id=request.user.id, user__is_active=True
            )
        else:
            try:
                queryset = OrganizationMember.objects.filter(
                    Q(user__is_active=True) | Q(user__isnull=True),
                    organization=organization,
                    id=member_id,
                    invite_status=InviteStatus.APPROVED.value,
                )
            except ValueError:
                raise OrganizationMember.DoesNotExist()
        return queryset.select_related("user").get()

    def _is_only_owner(self, member):
        if member.role != roles.get_top_dog().id:
            return False

        queryset = OrganizationMember.objects.filter(
            organization=member.organization_id,
            role=roles.get_top_dog().id,
            user__isnull=False,
            user__is_active=True,
        ).exclude(id=member.id)
        if queryset.exists():
            return False

        return True

    def _serialize_member(self, member, request, allowed_roles=None):
        context = serialize(member, serializer=OrganizationMemberWithTeamsSerializer())

        if request.access.has_scope("member:admin"):
            context["invite_link"] = member.get_invite_link()
            context["user"] = serialize(member.user, request.user, DetailedUserSerializer())

        context["isOnlyOwner"] = self._is_only_owner(member)
        context["roles"] = serialize(
            roles.get_all(), serializer=RoleSerializer(), allowed_roles=allowed_roles
        )

        return context

    def get(self, request, organization, member_id):
        """Currently only returns allowed invite roles for member invite"""

        try:
            member = self._get_member(request, organization, member_id)
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

        _, allowed_roles = get_allowed_roles(request, organization, member)

        context = self._serialize_member(member, request, allowed_roles)

        return Response(context)

    def put(self, request, organization, member_id):
        try:
            om = self._get_member(request, organization, member_id)
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = OrganizationMemberSerializer(data=request.data, partial=True)

        if not serializer.is_valid():
            return Response(status=400)

        try:
            auth_provider = AuthProvider.objects.get(organization=organization)
            auth_provider = auth_provider.get_provider()
        except AuthProvider.DoesNotExist:
            auth_provider = None

        allowed_roles = None
        result = serializer.validated_data

        # XXX(dcramer): if/when this expands beyond reinvite we need to check
        # access level
        if result.get("reinvite"):
            if om.is_pending:
                if ratelimits.for_organization_member_invite(
                    organization=organization, email=om.email, user=request.user, auth=request.auth,
                ):
                    metrics.incr(
                        "member-invite.attempt",
                        instance="rate_limited",
                        skip_internal=True,
                        sample_rate=1.0,
                    )
                    return Response({"detail": ERR_RATE_LIMITED}, status=429)

                if result.get("regenerate"):
                    if request.access.has_scope("member:admin"):
                        om.regenerate_token()
                        om.save()
                    else:
                        return Response({"detail": ERR_INSUFFICIENT_SCOPE}, status=400)
                if om.token_expired:
                    return Response({"detail": ERR_EXPIRED}, status=400)
                om.send_invite_email()
            elif auth_provider and not getattr(om.flags, "sso:linked"):
                om.send_sso_link_email(request.user, auth_provider)
            else:
                # TODO(dcramer): proper error message
                return Response({"detail": ERR_UNINVITABLE}, status=400)

        if "teams" in result:
            # dupe code from member_index
            # ensure listed teams are real teams
            teams = list(
                Team.objects.filter(
                    organization=organization, status=TeamStatus.VISIBLE, slug__in=result["teams"]
                )
            )

            if len(set(result["teams"])) != len(teams):
                return Response({"teams": "Invalid team"}, status=400)

            with transaction.atomic():
                # teams may be empty
                OrganizationMemberTeam.objects.filter(organizationmember=om).delete()
                OrganizationMemberTeam.objects.bulk_create(
                    [OrganizationMemberTeam(team=team, organizationmember=om) for team in teams]
                )

        if result.get("role"):
            _, allowed_roles = get_allowed_roles(request, organization)
            allowed_role_ids = {r.id for r in allowed_roles}

            # A user cannot promote others above themselves
            if result["role"] not in allowed_role_ids:
                return Response(
                    {"role": "You do not have permission to assign the given role."}, status=403
                )

            # A user cannot demote a superior
            if om.role not in allowed_role_ids:
                return Response(
                    {"role": "You do not have permission to assign a role to the given user."},
                    status=403,
                )

            if om.user == request.user and (result["role"] != om.role):
                return Response({"detail": "You cannot make changes to your own role."}, status=400)

            om.update(role=result["role"])

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=om.id,
            target_user=om.user,
            event=AuditLogEntryEvent.MEMBER_EDIT,
            data=om.get_audit_log_data(),
        )

        context = self._serialize_member(om, request, allowed_roles)

        return Response(context)

    def delete(self, request, organization, member_id):
        try:
            om = self._get_member(request, organization, member_id)
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

        if request.user.is_authenticated() and not is_active_superuser(request):
            try:
                acting_member = OrganizationMember.objects.get(
                    organization=organization, user=request.user
                )
            except OrganizationMember.DoesNotExist:
                return Response({"detail": ERR_INSUFFICIENT_ROLE}, status=400)
            else:
                if acting_member != om:
                    if not request.access.has_scope("member:admin"):
                        return Response({"detail": ERR_INSUFFICIENT_SCOPE}, status=400)
                    elif not roles.can_manage(acting_member.role, om.role):
                        return Response({"detail": ERR_INSUFFICIENT_ROLE}, status=400)

        # TODO(dcramer): do we even need this check?
        elif not request.access.has_scope("member:admin"):
            return Response({"detail": ERR_INSUFFICIENT_SCOPE}, status=400)

        if self._is_only_owner(om):
            return Response({"detail": ERR_ONLY_OWNER}, status=403)

        audit_data = om.get_audit_log_data()

        with transaction.atomic():
            AuthIdentity.objects.filter(
                user=om.user, auth_provider__organization=organization
            ).delete()

            om.delete()

        self.create_audit_entry(
            request=request,
            organization=organization,
            target_object=om.id,
            target_user=om.user,
            event=AuditLogEntryEvent.MEMBER_REMOVE,
            data=audit_data,
        )

        return Response(status=204)
