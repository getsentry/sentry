import io
from typing import Any

from django.core.files.uploadedfile import InMemoryUploadedFile
from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.api.bases.avatar import AvatarMixin
from sentry.users.api.bases.user import UserEndpoint
from sentry.users.models.user import User
from sentry.users.models.user_avatar import UserAvatar
from sentry.users.services.avatar_generation import AvatarGenerationError, avatar_generation_service
from sentry.users.services.user.serial import serialize_rpc_user
from sentry.users.services.user.service import user_service


@control_silo_endpoint
class UserAvatarEndpoint(AvatarMixin[UserAvatar], UserEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
        "PUT": ApiPublishStatus.PRIVATE,
    }
    object_type = "user"
    model = UserAvatar

    def get(self, request: Request, **kwargs: Any) -> Response:
        user: User = kwargs.pop(self.object_type, None)
        serialized_user = user_service.serialize_many(
            filter=dict(user_ids=[user.id]),
            as_user=serialize_rpc_user(user),
        )[0]
        return Response(serialized_user)

    def save_avatar(
        self, obj: Any, serializer: serializers.Serializer, **kwargs: Any
    ) -> tuple[UserAvatar, str | None]:
        """Override save_avatar to handle AI generation."""
        result = serializer.validated_data
        avatar_type = result["avatar_type"]

        if avatar_type == "ai_generated":
            prompt = result.get("ai_prompt", "")
            avatar_photo = result.get("avatar_photo")

            if prompt == "cropped_ai_avatar" and avatar_photo:
                # Cropped AI avatar - save the cropped image as ai_generated
                avatar = self.model.save_avatar(
                    relation={self.object_type: obj},
                    type="ai_generated",
                    avatar=avatar_photo,
                    filename=self.get_avatar_filename(obj),
                    color=result.get("color"),
                )
                return avatar, None
            elif prompt and not avatar_photo:
                # Generate new AI avatar
                try:
                    image_data = avatar_generation_service.generate_avatar(
                        prompt=prompt, user_id=obj.id
                    )

                    image_file = InMemoryUploadedFile(
                        file=io.BytesIO(image_data),
                        field_name="avatar_photo",
                        name=f"ai_avatar_{obj.id}.png",
                        content_type="image/png",
                        size=len(image_data),
                        charset=None,
                    )

                    avatar = self.model.save_avatar(
                        relation={self.object_type: obj},
                        type="ai_generated",
                        avatar=image_file,
                        filename=self.get_avatar_filename(obj),
                        color=result.get("color"),
                    )

                    return avatar, prompt

                except AvatarGenerationError as e:
                    raise serializers.ValidationError({"ai_prompt": str(e)})
            else:
                # No prompt provided, just set avatar type for existing AI avatar
                return super().save_avatar(obj, serializer, **kwargs), None

        return super().save_avatar(obj, serializer, **kwargs), None

    def put(self, request: Request, **kwargs: Any) -> Response:
        user: User = kwargs["user"]
        if user.id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)

        obj, serializer = super().parse(request, **kwargs)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user_avatar, used_prompt = self.save_avatar(obj, serializer)

        # Update the corresponding user attributes
        avatar_url = None
        if user_avatar.get_avatar_type_display() == "upload":
            from django.conf import settings

            # In development mode, use relative URLs so they can be proxied correctly
            # by the frontend dev server
            if getattr(settings, "DEBUG", False):
                avatar_url = f"/avatar/{user_avatar.ident}/"
            else:
                url_base = options.get("system.url-prefix")
                avatar_url = f"{url_base}/avatar/{user_avatar.ident}/"
        serialized_user = user_service.update_user(
            user_id=request.user.id,
            attrs=dict(avatar_url=avatar_url, avatar_type=user_avatar.avatar_type),
        )
        if serialized_user:
            # Add the used prompt to the response for AI-generated avatars
            response_data = serialized_user
            if used_prompt:
                response_data = {**serialized_user, "ai_prompt_used": used_prompt}
            return Response(response_data)
        return Response(status=status.HTTP_404_NOT_FOUND)
