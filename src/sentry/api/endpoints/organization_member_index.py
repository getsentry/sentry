from __future__ import absolute_import
import six

from django.db import transaction, IntegrityError
from django.db.models import Q
from rest_framework import serializers
from rest_framework.response import Response
from django.conf import settings


from sentry import roles
from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationPermission)
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.api.serializers.rest_framework import ListField
from sentry.models import AuditLogEntryEvent, OrganizationMember, OrganizationMemberTeam, Team, TeamStatus
from sentry.search.utils import tokenize_query
from sentry.signals import member_invited
from .organization_member_details import get_allowed_roles


class MemberPermission(OrganizationPermission):
    scope_map = {
        'GET': ['member:read', 'member:write', 'member:admin'],
        'POST': ['member:write', 'member:admin'],
        'PUT': ['member:write', 'member:admin'],
        'DELETE': ['member:admin'],
    }


class OrganizationMemberSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=75, required=False)
    role = serializers.ChoiceField(choices=roles.get_choices(), required=True)
    teams = ListField(required=False, allow_null=False)


class OrganizationMemberIndexEndpoint(OrganizationEndpoint):
    permission_classes = (MemberPermission, )

    @transaction.atomic
    def save_team_assignments(self, organization_member, teams):
        OrganizationMemberTeam.objects.filter(
            organizationmember=organization_member).delete()
        OrganizationMemberTeam.objects.bulk_create(
            [
                OrganizationMemberTeam(
                    team=team, organizationmember=organization_member)
                for team in teams
            ]
        )

    def get(self, request, organization):
        queryset = OrganizationMember.objects.filter(
            Q(user__is_active=True) | Q(user__isnull=True),
            organization=organization,
        ).select_related('user').order_by('email', 'user__email')

        query = request.GET.get('query')
        if query:
            tokens = tokenize_query(query)
            for key, value in six.iteritems(tokens):
                if key == 'email':
                    queryset = queryset.filter(
                        Q(user__email__in=value) | Q(
                            user__emails__email__in=value)
                    )

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )

    def post(self, request, organization):
        """
        Add a Member to Organization
        ````````````````````````````

        Invite a member to the organization.

        :pparam string organization_slug: the slug of the organization the member will belong to
        :param string email: the email address to invite
        :param string role: the role the new member
        :param array teams: the slugs of the teams the member should belong to.

        :auth: required
        """
        # TODO: If the member already exists, should this still update the role and team?
        # For now, it doesn't, but simply returns the existing object

        serializer = OrganizationMemberSerializer(data=request.DATA)

        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        result = serializer.object

        can_admin, allowed_roles = get_allowed_roles(request, organization)

        # ensure listed teams are real teams
        teams = list(Team.objects.filter(
            organization=organization,
            status=TeamStatus.VISIBLE,
            id__in=result['teams'],
        ))

        if len(set(result['teams'])) != len(teams):
            return Response({'teams': 'Invalid team'}, 400)

        if not result['role'] in {r.id for r in allowed_roles}:
            return Response({'role': 'You do not have permission to invite that role.'}, 403)

        # This is needed because `email` field is case sensitive, but from a user perspective,
        # Sentry treats email as case-insensitive (Eric@sentry.io equals eric@sentry.io).
        try:
            OrganizationMember.objects.filter(
                organization=organization,
                user__email__iexact=result['email'],
                user__is_active=True,
            )[0]

        except IndexError:
            pass
        else:
            return Response(
                {'exists': result['email']}, 400)

        om = OrganizationMember(
            organization=organization,
            email=result['email'],
            role=result['role'])

        if settings.SENTRY_ENABLE_INVITES:
            om.token = om.generate_token()

        sid = transaction.savepoint(using='default')
        try:
            om.save()

        except IntegrityError:
            transaction.savepoint_rollback(sid, using='default')
            return Response(
                {'exists': result['email']}, 400)

            return Response(serialize(OrganizationMember.objects.get(
                email__iexact=om.email,
                organization=organization,
            )), status=200)

        self.save_team_assignments(om, teams)

        if settings.SENTRY_ENABLE_INVITES:
            om.send_invite_email()
            member_invited.send(member=om, user=request.user, sender=self)

        self.create_audit_entry(
            request=request,
            organization_id=organization.id,
            target_object=om.id,
            event=AuditLogEntryEvent.MEMBER_INVITE if settings.SENTRY_ENABLE_INVITES else AuditLogEntryEvent.MEMBER_ADD,
        )

        return Response(serialize(om), status=201)
