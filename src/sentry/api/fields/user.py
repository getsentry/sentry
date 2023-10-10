from __future__ import annotations

from typing import Any

from rest_framework import serializers

from sentry.models.user import User
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.user.service import user_service


class UserField(serializers.Field):
    def to_representation(self, value: RpcUser) -> str:
        return value.username

    def to_internal_value(self, data: Any) -> RpcUser | User | None:
        if not data:
            return None

        if isinstance(data, int) or data.isdigit():
            user = user_service.get_user(user_id=data)
            if user is not None:
                return user

        try:
            return user_service.get_by_username(username=data)[0]
        except IndexError:
            raise serializers.ValidationError("Unable to find user")
