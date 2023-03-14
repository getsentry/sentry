from typing import Any, Tuple

from rest_framework import serializers, status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.fields import AvatarField
from sentry.api.serializers import serialize
from sentry.api.serializers.base import Serializer
from sentry.models.avatars.base import AvatarBase


class AvatarSerializer(serializers.Serializer):
    avatar_photo = AvatarField(required=False)
    avatar_type = serializers.ChoiceField(
        choices=(("upload", "upload"), ("gravatar", "gravatar"), ("letter_avatar", "letter_avatar"))
    )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        if attrs.get("avatar_type") == "upload":
            model_type = self.context["type"]
            kwargs_copy = self.context["kwargs"].copy()
            if "user" in kwargs_copy:
                user = kwargs_copy.pop("user")
                kwargs_copy["user_id"] = user.id
            has_existing_file = model_type.objects.filter(
                file_id__isnull=False, **kwargs_copy
            ).exists()
            if not has_existing_file and not attrs.get("avatar_photo"):
                raise serializers.ValidationError(
                    {"avatar_type": "Cannot set avatar_type to upload without avatar_photo"}
                )
        return attrs


class AvatarMixin:
    object_type = None
    model = None
    serializer_cls = AvatarSerializer

    def get(self, request: Request, **kwargs) -> Response:
        obj = kwargs.pop(self.object_type, None)
        return Response(serialize(obj, request.user, **kwargs))

    def get_serializer_context(self, obj, **kwargs):
        return {"type": self.model, "kwargs": {self.object_type: obj}}

    def get_avatar_filename(self, obj):
        return f"{obj.id}.png"

    def parse(self, request: Request, **kwargs) -> Tuple[Any, Serializer]:
        obj = kwargs.pop(self.object_type, None)

        serializer = self.serializer_cls(
            data=request.data, context=self.get_serializer_context(obj)
        )
        return (obj, serializer)

    def save_avatar(self, obj: Any, serializer: Serializer, **kwargs) -> AvatarBase:
        result = serializer.validated_data

        return self.model.save_avatar(
            relation={self.object_type: obj},
            type=result["avatar_type"],
            avatar=result.get("avatar_photo"),
            filename=self.get_avatar_filename(obj),
            color=result.get("color"),
        )

    def put(self, request: Request, **kwargs) -> Response:
        obj, serializer = self.parse(request, **kwargs)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.save_avatar(obj, serializer)
        obj = kwargs.pop(self.object_type, None)  # serialize doesn't like these params
        return Response(serialize(obj, request.user, **kwargs))
