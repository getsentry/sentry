from __future__ import annotations

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, control_silo_model
from sentry.models.avatars import ControlAvatarBase


@control_silo_model
class DocIntegrationAvatar(ControlAvatarBase):
    """
    A DocIntegrationAvatar associates a DocIntegration with a logo photo File.
    """

    AVATAR_TYPES = ((0, "upload"),)

    FILE_TYPE = "avatar.file"

    doc_integration = FlexibleForeignKey("sentry.DocIntegration", related_name="avatar")
    avatar_type = models.PositiveSmallIntegerField(
        default=0, db_default=0, choices=((0, "upload"),)
    )
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_docintegrationavatar"

    url_path = "doc-integration-avatar"

    def get_cache_key(self, size):
        return f"doc_integration_avatar:{self.doc_integration_id}:{size}"
