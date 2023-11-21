from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.avatar import AvatarMixin
from sentry.api.bases.user import UserEndpoint
from sentry.models.avatars.user_avatar import UserAvatar
from sentry.services.hybrid_cloud.user.serial import serialize_rpc_user
from sentry.services.hybrid_cloud.user.service import user_service


@control_silo_endpoint
class UserAvatarEndpoint(AvatarMixin[UserAvatar], UserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.UNKNOWN,
        "PUT": ApiPublishStatus.UNKNOWN,
    }
    object_type = "user"
    model = UserAvatar

    def get(self, request: Request, **kwargs) -> Response:
        user = kwargs.pop(self.object_type, None)
        serialized_user = user_service.serialize_many(
            filter=dict(user_ids=[user.id]),
            as_user=serialize_rpc_user(user),
        )[0]
        return Response(serialized_user)

    def put(self, request: Request, **kwargs) -> Response:
        user = kwargs["user"]
        if user.id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)

        obj, serializer = super().parse(request, **kwargs)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user_avatar = super().save_avatar(obj, serializer)

        # Update the corresponding user attributes
        avatar_url = None
        if user_avatar.get_avatar_type_display() == "upload":
            url_base = options.get("system.url-prefix")
            avatar_url = f"{url_base}/avatar/{user_avatar.ident}/"
        serialized_user = user_service.update_user(
            user_id=request.user.id,
            attrs=dict(avatar_url=avatar_url, avatar_type=user_avatar.avatar_type),
        )
        if serialized_user:
            return Response(serialized_user)
        return Response(status=status.HTTP_404_NOT_FOUND)
