from __future__ import absolute_import

from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.organization import (
    OrganizationEndpoint, OrganizationPermission
)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import (
    AuditLogEntryEvent, AuthProvider, OrganizationMember,
    OrganizationMemberType
)

ERR_NO_AUTH = 'You cannot remove this member with an unauthenticated API request.'

ERR_INSUFFICIENT_ROLE = 'You cannot remove a member who has more access than you.'

ERR_INSUFFICIENT_SCOPE = 'You are missing the member:delete scope.'

ERR_ONLY_OWNER = 'You cannot remove the only remaining owner of the organization.'

ERR_UNINVITABLE = 'You cannot send an invitation to a user who is already a full member.'


class OrganizationMemberSerializer(serializers.Serializer):
    reinvite = serializers.BooleanField()


class RelaxedOrganizationPermission(OrganizationPermission):
    scope_map = {
        'GET': ['member:read', 'member:write', 'member:delete'],
        'POST': ['member:write', 'member:delete'],
        'PUT': ['member:write', 'member:delete'],

        # DELETE checks for role comparison as you can either remove a member
        # with a lower access role, or yourself, without having the req. scope
        'DELETE': ['member:read', 'member:write', 'member:delete'],
    }


class OrganizationMemberDetailsEndpoint(OrganizationEndpoint):
    permission_classes = [RelaxedOrganizationPermission]

    def _get_member(self, request, organization, member_id):
        if member_id == 'me':
            queryset = OrganizationMember.objects.filter(
                organization=organization,
                user__id=request.user.id,
            )
        else:
            queryset = OrganizationMember.objects.filter(
                organization=organization,
                id=member_id,
            )
        return queryset.select_related('user').get()

    def _is_only_owner(self, member):
        if member.type != OrganizationMemberType.OWNER:
            return False

        queryset = OrganizationMember.objects.filter(
            organization=member.organization_id,
            type=OrganizationMemberType.OWNER,
            has_global_access=True,
            user__isnull=False,
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
        if request.user.is_superuser:
            authorizing_access = OrganizationMemberType.OWNER
        elif request.user.is_authenticated():
            try:
                authorizing_access = OrganizationMember.objects.get(
                    organization=organization,
                    user=request.user,
                    has_global_access=True,
                ).type
            except OrganizationMember.DoesNotExist:
                return Response({'detail': ERR_INSUFFICIENT_ROLE}, status=400)
        elif request.access.has_scope('member:delete'):
            authorizing_access = OrganizationMemberType.OWNER
        else:
            return Response({'detail': ERR_INSUFFICIENT_SCOPE}, status=400)

        try:
            om = self._get_member(request, organization, member_id)
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

        if om.type < authorizing_access:
            return Response({'detail': ERR_INSUFFICIENT_ROLE}, status=400)

        if self._is_only_owner(om):
            return Response({'detail': ERR_ONLY_OWNER}, status=403)

        audit_data = om.get_audit_log_data()

        if om.user_id == organization.owner_id:
            # TODO(dcramer): while we still maintain an owner field on
            # organization we need to ensure it transfers
            organization.owner = OrganizationMember.objects.filter(
                organization=om.organization,
                type=OrganizationMemberType.OWNER,
                user__isnull=False,
            ).exclude(id=om.id)[0].user
            organization.save()

        # TODO(dcramer): we should probably clean up AuthIdentity here
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
