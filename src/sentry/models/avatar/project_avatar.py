from django.db import models

from sentry.db.models import FlexibleForeignKey

from . import AvatarBase


class ProjectAvatar(AvatarBase):
    """
    A ProjectAvatar associates a Project with their avatar photo File
    and contains their preferences for avatar type.
    """

    AVATAR_TYPES = ((0, "letter_avatar"), (1, "upload"))

    FILE_TYPE = "avatar.file"

    project = FlexibleForeignKey("sentry.Project", unique=True, related_name="avatar")
    avatar_type = models.PositiveSmallIntegerField(default=0, choices=AVATAR_TYPES)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectavatar"

    def get_cache_key(self, size):
        return f"project_avatar:{self.project_id}:{size}"
