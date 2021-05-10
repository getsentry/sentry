from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import ObjectStatus, OrganizationIntegration


class OrganizationIntegrationsEndpoint(OrganizationEndpoint):
    permission_classes = (OrganizationIntegrationsPermission,)

    def get(self, request, organization):

        # filter by integration provider features
        features = [feature.lower() for feature in request.GET.getlist("features", [])]

        integrations = OrganizationIntegration.objects.filter(
            organization=organization, status=ObjectStatus.VISIBLE
        )

        if "provider_key" in request.GET:
            integrations = integrations.filter(integration__provider=request.GET["provider_key"])

        # include the configurations by default if no param
        include_config = True
        if request.GET.get("includeConfig") == "0":
            include_config = False

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
