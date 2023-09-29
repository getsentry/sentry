from __future__ import annotations

from enum import IntEnum
from typing import List

from django.db import models

from sentry.db.models import BaseManager, FlexibleForeignKey, control_silo_only_model

from ...db.models.outboxes import ControlOutboxProducingModel
from ...types.region import find_regions_for_user
from .. import ControlOutboxBase, OutboxCategory
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
class UserAvatar(ControlAvatarBase, ControlOutboxProducingModel):
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

    def outboxes_for_update(self, shard_identifier: int | None = None) -> List[ControlOutboxBase]:
        regions = find_regions_for_user(self.user_id)
        return [
            outbox
            for outbox in OutboxCategory.USER_UPDATE.as_control_outboxes(
                region_names=regions,
                shard_identifier=self.user_id,
                object_identifier=self.user_id,
            )
        ]

    def get_cache_key(self, size):
        return f"avatar:{self.user_id}:{size}"
