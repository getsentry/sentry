from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.models import Group, GroupSubscription


class OrganizationUserSubscribedEndpoint(OrganizationEndpoint):

    def get(self, request, organization, user_id):

        group_list = list(Group.objects.filter(
            id__in=GroupSubscription.objects.filter(
                user=user_id,
                is_active=True
            ).values_list('group', flat=True)
        ))

        return Response(serialize(group_list, request.user))
