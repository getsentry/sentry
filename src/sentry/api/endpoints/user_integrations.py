from django.db.models import Q

from sentry.api.bases.user import UserEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Integration, ObjectStatus


class UserIntegrationsEndpoint(UserEndpoint):
    def get(self, request, user):
        """
        Retrieve all of a users' organizations' integrations
        `````````````````````````````````

        :pparam string user ID: user ID, or 'me'
        :auth: required
        """
        queryset = Integration.objects.filter(
            organizations__in=user.get_orgs(), status=ObjectStatus.VISIBLE
        )

        query = request.GET.get("query")
        # query is the name of the integration provider, e.g. "slack"
        if query:
            queryset = queryset.filter(Q(provider__icontains=query))

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by="provider",
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
