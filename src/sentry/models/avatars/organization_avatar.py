from __future__ import annotations

from django.db import models

from sentry.db.models import FlexibleForeignKey, region_silo_model
from sentry.db.models.fields.bounded import BoundedBigIntegerField

from . import AvatarBase


@region_silo_model
class OrganizationAvatar(AvatarBase):
    """
    An OrganizationAvatar associates an Organization with their avatar photo File
    and contains their preferences for avatar type.
    """

    AVATAR_TYPES = ((0, "letter_avatar"), (1, "upload"))

    FILE_TYPE = "avatar.file"

    file_id = BoundedBigIntegerField(unique=True, null=True)

    organization = FlexibleForeignKey("sentry.Organization", unique=True, related_name="avatar")
    avatar_type = models.PositiveSmallIntegerField(default=0, choices=AVATAR_TYPES)

    url_path = "organization-avatar"

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationavatar"

    def get_cache_key(self, size):
        return f"org_avatar:{self.organization_id}:{size}"
