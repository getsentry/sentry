from collections.abc import Sequence
from enum import Enum

from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedIntegerField,
    FlexibleForeignKey,
    Model,
    region_silo_model,
    sane_repr,
)


class EventType(Enum):
    PROFILE = 0
    PROFILE_CHUNK = 1

    @classmethod
    def as_choices(cls) -> Sequence[tuple[int, str]]:
        return (
            (cls.PROFILE.value, "profile"),
            (cls.PROFILE_CHUNK.value, "profile_chunk"),
        )


@region_silo_model
class ProjectSDK(Model):
    __relocation_scope__ = RelocationScope.Organization

    date_updated = models.DateTimeField(auto_now=True)

    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)
    event_type = BoundedIntegerField(choices=EventType.as_choices())
    sdk_name = models.CharField()
    sdk_version = models.CharField()

    class Meta:
        indexes = (models.Index(fields=["project", "event_type"]),)
        unique_together = (("project", "event_type", "sdk_name"),)

    __repr__ = sane_repr("project", "event_type", "sdk_name", "sdk_version")
