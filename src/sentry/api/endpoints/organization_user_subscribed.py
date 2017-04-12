from __future__ import absolute_import

from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.api.models import GroupSubscription


class OrganizationUserSubscribedEndpoint(OrganizationEndpoint):

    def get(self, request, organization, user):

        subscription_list = list(GroupSubscription.objects.filter(
            user=user,
        ).order_by('name', 'slug'))

        return Response(serialize(subscription_list, request.user))
