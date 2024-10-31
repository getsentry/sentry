from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers.base import serialize
from sentry.models.rollbackuser import RollbackUser
from sentry.users.api.bases.user import RegionSiloUserEndpoint
from sentry.users.api.serializers.userrollback import UserRollbacksSerializer
from sentry.users.services.user.model import RpcUser


@region_silo_endpoint
class UserRollbacksEndpoint(RegionSiloUserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    scope_map = {
        "GET": ["member:read"],
    }

    def get(self, request: Request, user: RpcUser) -> Response:
        """
        Get rollback information for the current user
        `````````````````````````````````````````

        Retrieve rollback information for the current user in the organization.
        """
        queryset = RollbackUser.objects.filter(user_id=user.id).order_by("organization__name")

        return self.paginate(
            request=request,
            paginator_cls=OffsetPaginator,
            queryset=queryset,
            on_results=lambda x: serialize(x, request.user, serializer=UserRollbacksSerializer()),
        )
