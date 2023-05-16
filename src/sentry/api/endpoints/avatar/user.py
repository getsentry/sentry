from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import region_silo_endpoint
from sentry.api.bases.avatar import AvatarMixin
from sentry.api.bases.user import UserEndpoint
from sentry.models import UserAvatar
from sentry.services.hybrid_cloud.user.service import user_service
from sentry.types.region import get_local_region


# TODO(hybridcloud) This needs to become a control_silo_endpoint again.
# Doing this requires that we solve File uploads for ControlSilo
#
# This implementation deviates a bit from the typical AvatarMixin because of hybrid cloud
# We have the usual problems with user->user_id translation, but also need to handle synchronizing
# attributes across silos to avoid fetching user avatars from user serializers.
# Despite updating a user attribute, user avatar FILEs live on regions. This allows us to avoid
# running file stores on the control silo. So we simply update the user with the new attributes.
@region_silo_endpoint
class UserAvatarEndpoint(AvatarMixin, UserEndpoint):
    object_type = "user"
    model = UserAvatar

    def get(self, request: Request, **kwargs) -> Response:
        user = kwargs.pop(self.object_type, None)
        serialized_user = user_service.serialize_many(
            filter=dict(user_ids=[user.id]),
            as_user=user,
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
            avatar_url = get_local_region().to_url(f"/avatar/{user_avatar.ident}/")
        serialized_user = user_service.update_user(
            user_id=request.user.id,
            attrs=dict(avatar_url=avatar_url, avatar_type=user_avatar.avatar_type),
        )
        return Response(serialized_user)
