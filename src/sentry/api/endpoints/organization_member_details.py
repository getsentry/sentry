from __future__ import absolute_import

from django.db import transaction
from django.db.models import Q
from rest_framework import serializers
from rest_framework.response import Response

from sentry import roles
from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationPermission
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import (
    AuditLogEntryEvent, AuthIdentity, AuthProvider, OrganizationMember
)

ERR_NO_AUTH = 'You cannot remove this member with an unauthenticated API request.'

ERR_INSUFFICIENT_ROLE = 'You cannot remove a member who has more access than you.'

ERR_INSUFFICIENT_SCOPE = 'You are missing the member:delete scope.'

ERR_ONLY_OWNER = 'You cannot remove the only remaining owner of the organization.'

ERR_UNINVITABLE = 'You cannot send an invitation to a user who is already a full member.'


class OrganizationMemberSerializer(serializers.Serializer):
    reinvite = serializers.BooleanField()


class RelaxedMemberPermission(OrganizationPermission):
    scope_map = {
        'GET': ['member:read', 'member:write', 'member:delete'],
        'POST': ['member:write', 'member:delete'],
        'PUT': ['member:write', 'member:delete'],

        # DELETE checks for role comparison as you can either remove a member
        # with a lower access role, or yourself, without having the req. scope
        'DELETE': ['member:read', 'member:write', 'member:delete'],
    }


class OrganizationMemberDetailsEndpoint(OrganizationEndpoint):
    permission_classes = [RelaxedMemberPermission]

    def _get_member(self, request, organization, member_id):
        if member_id == 'me':
            queryset = OrganizationMember.objects.filter(
                organization=organization,
                user__id=request.user.id,
                user__is_active=True,
            )
        else:
            queryset = OrganizationMember.objects.filter(
                Q(user__is_active=True) | Q(user__isnull=True),
                organization=organization,
                id=member_id,
            )
        return queryset.select_related('user').get()

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

    def put(self, request, organization, member_id):
        try:
            om = self._get_member(request, organization, member_id)
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

        serializer = OrganizationMemberSerializer(data=request.DATA, partial=True)
        if not serializer.is_valid():
            return Response(status=400)

        has_sso = AuthProvider.objects.filter(
            organization=organization,
        ).exists()

        result = serializer.object
        # XXX(dcramer): if/when this expands beyond reinvite we need to check
        # access level
        if result.get('reinvite'):
            if om.is_pending:
                om.send_invite_email()
            elif has_sso and not getattr(om.flags, 'sso:linked'):
                om.send_sso_link_email()
            else:
                # TODO(dcramer): proper error message
                return Response({'detail': ERR_UNINVITABLE}, status=400)
        return Response(status=204)

    def delete(self, request, organization, member_id):
        try:
            om = self._get_member(request, organization, member_id)
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

        if request.user.is_authenticated() and not request.is_superuser():
            try:
                acting_member = OrganizationMember.objects.get(
                    organization=organization,
                    user=request.user,
                )
            except OrganizationMember.DoesNotExist:
                return Response({'detail': ERR_INSUFFICIENT_ROLE}, status=400)
            else:
                if not acting_member.can_manage_member(om):
                    return Response({'detail': ERR_INSUFFICIENT_ROLE}, status=400)

        # TODO(dcramer): do we even need this check?
        elif not request.access.has_scope('member:delete'):
            return Response({'detail': ERR_INSUFFICIENT_SCOPE}, status=400)

        if self._is_only_owner(om):
            return Response({'detail': ERR_ONLY_OWNER}, status=403)

        audit_data = om.get_audit_log_data()

        with transaction.atomic():
            AuthIdentity.objects.filter(
                user=om.user,
                auth_provider__organization=organization,
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
