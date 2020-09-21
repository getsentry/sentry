from __future__ import absolute_import
from rest_framework.response import Response

from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.models import OrganizationOption, RelayUsage
from sentry import features


class OrganizationRelayHistory(OrganizationEndpoint):
    permission_classes = (OrganizationPermission,)

    def get(self, request, organization):
        has_relays = features.has("organizations:relay", organization, actor=request.user)
        if not has_relays:
            return Response(status=404)

        option_key = "sentry:trusted-relays"
        try:
            trusted_relays = OrganizationOption.objects.get(
                organization=organization, key=option_key
            )
            keys = [val.get("public_key") for val in trusted_relays.value]
            if len(keys) == 0:
                return Response([], status=200)

        except OrganizationOption.DoesNotExist:
            return Response([], status=200)

        relay_history = list(RelayUsage.objects.filter(public_key__in=keys))

        return Response(serialize(relay_history, request.user))
