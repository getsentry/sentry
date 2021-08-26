from django.db import models

from sentry.db.models import BoundedBigIntegerField, Model, sane_repr


class GroupRedirect(Model):
    """
    Maintains a reference from a group that has been merged (and subsequently
    deleted) to the group that superseded it.
    """

    __include_in_export__ = False

    organization_id = BoundedBigIntegerField(null=True)
    group_id = BoundedBigIntegerField(db_index=True)
    previous_group_id = BoundedBigIntegerField(unique=True)
    previous_short_id = BoundedBigIntegerField(null=True)
    previous_project_slug = models.SlugField(null=True)

    class Meta:
        db_table = "sentry_groupredirect"
        app_label = "sentry"
        unique_together = (("organization_id", "previous_short_id", "previous_project_slug"),)

    __repr__ = sane_repr(
        "group_id", "previous_group_id", "previous_short_id", "previous_project_slug"
    )

    @classmethod
    def create_for_group(cls, from_group, to_group):
        return cls.objects.create(
            organization_id=to_group.project.organization_id,
            group_id=to_group.id,
            previous_group_id=from_group.id,
            previous_short_id=from_group.short_id,
            previous_project_slug=from_group.project.slug,
        )
