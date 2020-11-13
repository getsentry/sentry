from __future__ import absolute_import

from django.db import models

from sentry.db.models import BaseManager, FlexibleForeignKey

from . import AvatarBase


class UserAvatar(AvatarBase):
    """
    A UserAvatar associates a User with their avatar photo File
    and contains their preferences for avatar type.
    """

    AVATAR_TYPES = ((0, u"letter_avatar"), (1, u"upload"), (2, u"gravatar"))

    FILE_TYPE = "avatar.file"

    user = FlexibleForeignKey("sentry.User", unique=True, related_name="avatar")
    avatar_type = models.PositiveSmallIntegerField(default=0, choices=AVATAR_TYPES)

    objects = BaseManager(cache_fields=["user"])

    class Meta:
        app_label = "sentry"
        db_table = "sentry_useravatar"

    def get_cache_key(self, size):
        return "avatar:%s:%s" % (self.user_id, size)
