from __future__ import absolute_import

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from sentry import roles
from sentry.api.base import Endpoint, SessionAuthentication
from sentry.api.serializers import serialize
from sentry.api.serializers.models.organization import DetailedOrganizationSerializer
from sentry.models import Organization, OrganizationMember, OrganizationStatus


class IntegrationInstallationEndpoint(Endpoint):
    authentication_classes = (SessionAuthentication, )
    permission_classes = (IsAuthenticated, )

    def get(self, request):
        organizations = Organization.objects.filter(
            status=OrganizationStatus.ACTIVE,
            id__in=OrganizationMember.objects.filter(
                user=request.user,
                role=roles.get_top_dog().id,
            ).values_list('organization_id', flat=True),
        )

        return Response({
            'organizations': serialize(list(organizations), request.user, DetailedOrganizationSerializer()),
        })
