from __future__ import annotations

from typing import ClassVar

from django.db import models

from sentry.db.models import BaseManager, FlexibleForeignKey, control_silo_only_model

from . import ControlAvatarBase


@control_silo_only_model
class UserAvatar(ControlAvatarBase):
    """
    A UserAvatar associates a User with their avatar photo File
    and contains their preferences for avatar type.
    """

    AVATAR_TYPES: ClassVar[tuple[tuple[int, str], ...]] = (
        (0, "letter_avatar"),
        (1, "upload"),
        (2, "gravatar"),
    )

    FILE_TYPE: ClassVar[str] = "avatar.file"

    user = FlexibleForeignKey("sentry.User", unique=True, related_name="avatar")
    avatar_type = models.PositiveSmallIntegerField(default=0, choices=AVATAR_TYPES)

    objects = BaseManager(cache_fields=["user"])

    class Meta:
        app_label = "sentry"
        db_table = "sentry_useravatar"

    def get_cache_key(self, size):
        return f"avatar:{self.user_id}:{size}"
