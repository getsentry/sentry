from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.organization import OrganizationAuthProviderPermission, OrganizationEndpoint
from sentry.api.serializers import serialize
from sentry.auth import manager


@region_silo_endpoint
class OrganizationAuthProvidersEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationAuthProviderPermission,)

    def get(self, request: Request, organization) -> Response:
        """
        List available auth providers that are available to use for an Organization
        ```````````````````````````````````````````````````````````````````````````

        :pparam string organization_slug: the organization short name
        :auth: required
        """
        provider_list = []
<<<<<<< HEAD
<<<<<<< HEAD

        for k, v in manager:
            if v.is_partner is False:
                provider_list.append(
                    {"key": k, "name": v.name, "requiredFeature": v.required_feature}
                )
=======
        print("org in list", organization)
        partnered_subscription_type = organization.subscription.current_history().sponsored_type if hasattr(organization, 'subscription') else None

        channel = None
        if (partnered_subscription_type is not None):
            channel = SPONSORSHIP_TO_CHANNEL_MAP.get(partnered_subscription_type)

        for k, v in manager:
            if (v.is_partner is False or (channel and SPONSOR_OAUTH_NAME[channel] == v.name)):
                provider_list.append({"key": k, "name": v.name, "requiredFeature": v.required_feature})
>>>>>>> aef2fff949 ([WIP]feat(fly-auth): remove fly auth from list)
=======

        for k, v in manager:
            if v.is_partner is False:
                provider_list.append(
                    {"key": k, "name": v.name, "requiredFeature": v.required_feature}
                )
>>>>>>> dfedb6f768 (feat(fly-auth): remove check for partner orgs)

        return Response(serialize(provider_list, request.user))
