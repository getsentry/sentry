from sentry.api.bases.user import UserEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import ObjectStatus, OrganizationIntegration


class UserOrganizationIntegrationsEndpoint(UserEndpoint):
    def get(self, request, user):
        """
        Retrieve all of a users' organization integrations
        `````````````````````````````````

        :pparam string user ID: user ID, or 'me'
        :qparam string provider: optional provider to filter by
        :auth: required
        """
        queryset = OrganizationIntegration.objects.filter(
            organization__in=user.get_orgs(),
            status=ObjectStatus.VISIBLE,
            integration__status=ObjectStatus.VISIBLE,
        )
        provider = request.GET.get("provider")
        if provider:
            queryset = queryset.filter(integration__provider=provider.lower())

        return self.paginate(
            request=request,
            queryset=queryset,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
