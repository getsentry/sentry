from __future__ import annotations

from enum import IntEnum

from django.db import models

from sentry.db.models import BaseManager, FlexibleForeignKey, control_silo_only_model

from . import ControlAvatarBase


class UserAvatarType(IntEnum):
    LETTER_AVATAR = 0
    UPLOAD = 1
    GRAVATAR = 2

    def api_name(self):
        return self.name.lower()

    @classmethod
    def as_choices(cls) -> tuple[tuple[int, str], ...]:
        return (
            (cls.LETTER_AVATAR, cls.LETTER_AVATAR.api_name()),
            (cls.UPLOAD, cls.UPLOAD.api_name()),
            (cls.GRAVATAR, cls.GRAVATAR.api_name()),
        )


@control_silo_only_model
class UserAvatar(ControlAvatarBase):
    """
    A UserAvatar associates a User with their avatar photo File
    and contains their preferences for avatar type.
    """

    AVATAR_TYPES = UserAvatarType.as_choices()

    FILE_TYPE = "avatar.file"

    user = FlexibleForeignKey("sentry.User", unique=True, related_name="avatar")
    avatar_type = models.PositiveSmallIntegerField(default=0, choices=UserAvatarType.as_choices())

    objects = BaseManager(cache_fields=["user"])

    class Meta:
        app_label = "sentry"
        db_table = "sentry_useravatar"

    def get_cache_key(self, size):
        return f"avatar:{self.user_id}:{size}"
