from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.auth.principal import acting_user_id
from sentry.auth.services.access.service import access_service
from sentry.auth.staff import is_active_staff
from sentry.models.authidentity import AuthIdentity
from sentry.users.api.bases.user import UserEndpoint, UserPermission
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


class UserIdentityDetailsPermission(UserPermission):
    """
    `_admin` removes org identities through this endpoint, and `_admin` sessions run
    in staff mode rather than superuser mode. Staff alone gives no write access to
    another user's identities, so staff must also hold `superuser.write`, the same
    permission an active superuser needs for this request.
    """

    def has_object_permission(
        self, request: Request, view: APIView, user: User | RpcUser | None
    ) -> bool:
        if super().has_object_permission(request, view, user):
            return True
        if request.auth or not is_active_staff(request):
            return False
        user_id = acting_user_id(request.user)
        if user_id is None:
            return False
        return "superuser.write" in access_service.get_permissions_for_user(user_id)


@control_silo_endpoint
class UserIdentityDetailsEndpoint(UserEndpoint):
    publish_status = {
        "DELETE": ApiPublishStatus.PRIVATE,
    }
    permission_classes = (UserIdentityDetailsPermission,)

    def delete(self, request: Request, user: User, identity_id: int) -> Response:
        try:
            ai = AuthIdentity.objects.get(user=user, id=identity_id)
            ai.delete()
        except AuthIdentity.DoesNotExist:
            pass
        return Response(status=204)
