from __future__ import annotations

from collections import defaultdict
from enum import Enum
from typing import TYPE_CHECKING, List

from django.db import models

from sentry.db.models import FlexibleForeignKey
from sentry.db.models.manager import BaseManager

from . import AvatarBase

if TYPE_CHECKING:
    from sentry.models import SentryApp


class SentryAppAvatarTypes(Enum):
    DEFAULT = 0
    UPLOAD = 1

    @classmethod
    def get_choices(cls):
        return tuple((_.value, _.name.lower()) for _ in SentryAppAvatarTypes)


class SentryAppAvatarManager(BaseManager):
    def get_by_apps_as_dict(self, sentry_apps: List[SentryApp]):
        """
        Returns a dict mapping sentry_app_id (key) to List[SentryAppAvatar] (value)
        """
        avatars = SentryAppAvatar.objects.filter(sentry_app__in=sentry_apps)
        avatar_to_app_map = defaultdict(set)
        for avatar in avatars:
            avatar_to_app_map[avatar.sentry_app_id].add(avatar)
        return avatar_to_app_map


class SentryAppAvatar(AvatarBase):
    """
    A SentryAppAvatar associates a SentryApp with a logo photo File
    and specifies which type of logo it is.
    """

    objects = SentryAppAvatarManager()

    AVATAR_TYPES = SentryAppAvatarTypes.get_choices()

    FILE_TYPE = "avatar.file"

    sentry_app = FlexibleForeignKey("sentry.SentryApp", related_name="avatar")
    avatar_type = models.PositiveSmallIntegerField(default=0, choices=AVATAR_TYPES)
    color = models.BooleanField(default=False)
    # e.g. issue linking logos will not have color

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappavatar"

    def get_cache_key(self, size):
        color_identifier = "color" if self.color else "simple"
        return f"sentry_app_avatar:{self.sentry_app_id}:{color_identifier}:{size}"
