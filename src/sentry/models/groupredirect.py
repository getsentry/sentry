from __future__ import annotations
from typing import int

from django.db import models
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedBigIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.models.group import Group


@region_silo_model
class GroupRedirect(Model):
    """
    Maintains a reference from a group that has been merged (and subsequently
    deleted) to the group that superseded it.
    """

    __relocation_scope__ = RelocationScope.Excluded

    organization_id = BoundedBigIntegerField(null=True)
    group = FlexibleForeignKey(
        "sentry.Group", related_name="primary_group_of_redirect", db_constraint=False
    )
    previous_group_id = BoundedBigIntegerField(unique=True)
    previous_short_id = BoundedBigIntegerField(null=True)
    previous_project_slug = models.SlugField(null=True)
    date_added = models.DateTimeField(default=timezone.now, null=True)

    class Meta:
        db_table = "sentry_groupredirect"
        app_label = "sentry"
        unique_together = (("organization_id", "previous_short_id", "previous_project_slug"),)

    __repr__ = sane_repr(
        "group_id", "previous_group_id", "previous_short_id", "previous_project_slug"
    )

    @classmethod
    def create_for_group(cls, from_group: Group, to_group: Group) -> GroupRedirect:
        return cls.objects.create(
            organization_id=to_group.project.organization_id,
            group=to_group,
            previous_group_id=from_group.id,
            previous_short_id=from_group.short_id,
            previous_project_slug=from_group.project.slug,
        )
