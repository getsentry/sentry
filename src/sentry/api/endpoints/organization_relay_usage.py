from __future__ import absolute_import
from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.models import RelayUsage
from sentry import features


class OrganizationRelayUsage(OrganizationEndpoint):
    permission_classes = (OrganizationPermission,)

    def get(self, request, organization):
        has_relays = features.has("organizations:relay", organization, actor=request.user)
        if not has_relays:
            return Response(status=404)

        option_key = "sentry:trusted-relays"
        trusted_relays = organization.get_option(option_key)
        if trusted_relays is None or len(trusted_relays) == 0:
            return Response([], status=200)

        keys = [val.get("public_key") for val in trusted_relays]
        relay_history = list(RelayUsage.objects.filter(public_key__in=keys))

        return Response(serialize(relay_history, request.user))
