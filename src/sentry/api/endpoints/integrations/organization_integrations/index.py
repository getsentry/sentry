from __future__ import annotations

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.bases.organization import OrganizationEndpoint, OrganizationIntegrationsPermission
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import ObjectStatus, Organization, OrganizationIntegration


def query_param_to_bool(value: bool | int | str | None, default: bool = False) -> bool:
    """
    Generic parser for boolean-like query parameters.
    TODO(mgaeta): Move this to somewhere in utils.
    """
    if value is None:
        return default

    if isinstance(value, int):
        return value > 0

    if isinstance(value, bool):
        return value

    try:
        int_value = int(value)
    except ValueError:
        int_value = None

    if int_value is not None:
        return int_value > 0

    if value == "":
        return default

    return value.lower() in {"on", "true"}


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
