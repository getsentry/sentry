from __future__ import annotations

from urllib.parse import urljoin

from django.db import models
from django.urls import reverse

from sentry.db.models import FlexibleForeignKey, cell_silo_model
from sentry.db.models.fields.bounded import BoundedBigIntegerField
from sentry.models.organization import Organization
from sentry.models.team import Team
from sentry.types.cell import get_local_locality

from . import AvatarBase


@cell_silo_model
class TeamAvatar(AvatarBase):
    """
    A TeamAvatar associates a Team with their avatar photo File
    and contains their preferences for avatar type.
    """

    AVATAR_TYPES = ((0, "letter_avatar"), (1, "upload"))

    FILE_TYPE = "avatar.file"

    file_id = BoundedBigIntegerField(unique=True, null=True)
    team = FlexibleForeignKey("sentry.Team", unique=True, related_name="avatar")
    avatar_type = models.PositiveSmallIntegerField(default=0, choices=AVATAR_TYPES)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_teamavatar"

    url_path = "team-avatar"

    def get_cache_key(self, size):
        return f"team_avatar:{self.team_id}:{size}"

    def absolute_url(self) -> str:
        team = Team.objects.get_from_cache(id=self.team_id)
        organization = Organization.objects.get_from_cache(id=team.organization_id)
        url_base = get_local_locality().to_url("")
        path = reverse("sentry-team-avatar-url", args=[organization.slug, self.ident])
        return urljoin(url_base, path)
