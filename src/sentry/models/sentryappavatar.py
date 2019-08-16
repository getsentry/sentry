from __future__ import absolute_import

from django.db import models

from sentry.db.models import FlexibleForeignKey

from . import AvatarBase


class SentryAppAvatar(AvatarBase):
    """
    A SentryAppAvatar associates a SentryApp with an avatar photo File
    and contains the preferences for avatar type.
    """

    AVATAR_TYPES = ((0, "letter_avatar"), (1, "upload"))

    FILE_TYPE = "avatar.file"

    sentry_app = FlexibleForeignKey("sentry.SentryApp", unique=True, related_name="avatar")
    avatar_type = models.PositiveSmallIntegerField(default=0, choices=AVATAR_TYPES)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappavatar"

    def get_cache_key(self, size):
        return "sentry_app_avatar:%s:%s" % (self.sentry_app_id, size)
