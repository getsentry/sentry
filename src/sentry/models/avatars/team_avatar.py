from django.db import models

from sentry.db.models import FlexibleForeignKey

from . import AvatarBase


class TeamAvatar(AvatarBase):
    """
    A TeamAvatar associates a Team with their avatar photo File
    and contains their preferences for avatar type.
    """

    AVATAR_TYPES = ((0, "letter_avatar"), (1, "upload"))

    FILE_TYPE = "avatar.file"

    team = FlexibleForeignKey("sentry.Team", unique=True, related_name="avatar")
    avatar_type = models.PositiveSmallIntegerField(default=0, choices=AVATAR_TYPES)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_teamavatar"

    def get_cache_key(self, size):
        return f"team_avatar:{self.team_id}:{size}"
