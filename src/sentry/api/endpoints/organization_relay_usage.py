from rest_framework.response import Response

from sentry import features
from sentry.api.bases import OrganizationEndpoint, OrganizationPermission
from sentry.api.serializers import serialize
from sentry.models import RelayUsage


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
        relay_history = list(RelayUsage.objects.filter(public_key__in=keys).order_by("-last_seen"))

        return Response(serialize(relay_history, request.user))
