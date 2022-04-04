from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import ObjectStatus, Organization, OrganizationIntegration


class OrganizationIntegrationsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission,)

    def get(self, request: Request, organization: Organization) -> Response:
        """
        List the available Integrations for an Organization
        ```````````````````````````````````````````````````

        :pparam string organization_slug: The slug of the organization.

        :qparam string provider_key: Filter by specific integration provider. (e.g. "slack")
        :qparam string[] features: Filter by integration features names.
        :qparam bool includeConfig: Should integrations configurations be fetched from third-party
            APIs? This can add several thousand ms to the request round trip.

        :auth: required
        """

        feature_filters = request.GET.getlist("features", [])
        provider_key = request.GET.get("provider_key", "")
        include_config_raw = request.GET.get("includeConfig")

        # filter by integration provider features
        features = [feature.lower() for feature in feature_filters]

        # show disabled org integrations but not ones being deleted
        integrations = OrganizationIntegration.objects.filter(
            organization=organization,
            status__in=[ObjectStatus.VISIBLE, ObjectStatus.DISABLED, ObjectStatus.PENDING_DELETION],
        )

        if provider_key:
            integrations = integrations.filter(integration__provider=provider_key.lower())

        # Include the configurations by default if includeConfig is not present.
        # TODO(mgaeta): HACK. We need a consistent way to get booleans from query parameters.
        include_config = include_config_raw != "0"

        def on_results(results):
            if len(features):
                return [
                    serialize(
                        i,
                        request.user,
                        include_config=include_config,
                    )
                    for i in filter(
                        # check if any feature in query param is in the provider feature list
                        lambda i: any(
                            f
                            in [
                                feature.name.lower()
                                for feature in list(i.integration.get_provider().features)
                            ]
                            for f in features
                        ),
                        results,
                    )
                ]

            return serialize(results, request.user, include_config=include_config)

        return self.paginate(
            queryset=integrations,
            request=request,
            order_by="integration__name",
            on_results=on_results,
            paginator_cls=OffsetPaginator,
        )
