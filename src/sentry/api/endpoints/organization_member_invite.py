from __future__ import absolute_import

from django.conf import settings
from django.contrib import messages

from django.utils.translation import ugettext_lazy as _

# from rest_framework import serializers
from rest_framework.response import Response

from sentry import roles
from sentry.api.bases.organization import (OrganizationEndpoint)
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.models import (OrganizationMember)
from sentry.signals import member_invited

# from sentry.signals import sso_enabled
from sentry.api.serializers import serialize, RoleSerializer

ERR_NO_AUTH = 'You cannot remove this member with an unauthenticated API request.'

ERR_INSUFFICIENT_SCOPE = 'You are missing the member:admin scope.'

ERR_UNINVITABLE = 'You cannot send an invitation to a user who is already a full member.'


class OrganizationMemberInviteEndpoint(OrganizationEndpoint):
    def _get_member(self, request, organization):
        queryset = OrganizationMember.objects.filter(
            organization=organization,
            user__id=request.user.id,
            user__is_active=True,
        )
        return queryset.select_related('user').get()

    def get_allowed_roles(self, request, organization, member=None):
        can_admin = request.access.has_scope('member:admin')

        allowed_roles = []
        if can_admin and not request.is_superuser():
            acting_member = OrganizationMember.objects.get(
                user=request.user,
                organization=organization,
            )
            if member and roles.get(acting_member.role).priority < roles.get(member.role).priority:
                can_admin = False
            else:
                allowed_roles = [
                    r for r in roles.get_all()
                    if r.priority <= roles.get(acting_member.role).priority
                ]
                can_admin = bool(allowed_roles)
        elif request.is_superuser():
            allowed_roles = roles.get_all()
        return (can_admin, allowed_roles, )

    def get(self, request, organization):
        can_admin, allowed_roles = self.get_allowed_roles(
            request, organization)

        context = {
            'is_invite': settings.SENTRY_ENABLE_INVITES,
            'role_list': [{'role': serialize(r, serializer=RoleSerializer()), 'allowed': r in allowed_roles} for r in roles.get_all()],
        }
        return Response(context, status=200)

    def put(self, request, organization):
        # try:
        #     om = self._get_member(request, organization)
        # except OrganizationMember.DoesNotExist:
        #     raise ResourceDoesNotExist
        user_display = request.DATA['email']

        try:
            om = self._get_member(request, organization)
        except OrganizationMember.DoesNotExist:
            raise ResourceDoesNotExist

        # user doesn't exist
        if True:
            messages.add_message(
                request, messages.SUCCESS,
                _('The organization member %s was added.') % user_display
            )
            member_invited.send(
                member=om, user=request.user, sender=self)

        else:
            messages.add_message(
                request, messages.INFO,
                _('The organization member %s already exists.') % user_display
            )

        return Response({}, status=400)
