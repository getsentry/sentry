from sentry.api.bases.user import UserEndpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.models import Identity


class UserIdentityEndpoint(UserEndpoint):
    def get(self, request, user):
        """
        Retrieve all of a users' identities (NOT AuthIdentities)
        `````````````````````````````````

        :pparam string user ID: user ID, or 'me'
        :auth: required
        """
        identities = Identity.objects.filter(user=user)
        return self.paginate(
            request=request,
            queryset=identities,
            on_results=lambda x: serialize(x, request.user),
            paginator_cls=OffsetPaginator,
        )
