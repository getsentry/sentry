from __future__ import annotations

from collections.abc import Sequence
from enum import Enum

from django.db import models
from packaging.version import InvalidVersion
from packaging.version import parse as parse_version

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedIntegerField, FlexibleForeignKey, region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.models.project import Project
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text


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
class ProjectSDK(DefaultFieldsModel):
    __relocation_scope__ = RelocationScope.Organization

    date_updated = models.DateTimeField(auto_now=True)

    project = FlexibleForeignKey("sentry.Project", on_delete=models.CASCADE)
    event_type = BoundedIntegerField(choices=EventType.as_choices())
    sdk_name = models.CharField()
    sdk_version = models.CharField()

    class Meta:
        unique_together = (("project", "event_type", "sdk_name"),)

    __repr__ = sane_repr("project", "event_type", "sdk_name", "sdk_version")

    @classmethod
    def get_cache_key(cls, project: Project, event_type: EventType, sdk_name: str):
        return f"projectsdk:1:{project.id}:{event_type.value}:{md5_text(sdk_name).hexdigest()}"

    @classmethod
    def update_with_newest_version_or_create(
        cls,
        project: Project,
        event_type: EventType,
        sdk_name: str,
        sdk_version: str,
    ) -> ProjectSDK:
        with metrics.timer(
            "models.projectsdk.update_with_newest_version_or_create"
        ) as metrics_tags:
            cache_key = cls.get_cache_key(project, event_type, sdk_name)
            project_sdk = cache.get(cache_key)

            if project_sdk is None:
                metrics_tags["cache_hit"] = "false"
                project_sdk, created = cls.objects.get_or_create(
                    project=project,
                    event_type=event_type.value,
                    sdk_name=sdk_name,
                )
            else:
                metrics_tags["cache_hit"] = "true"
                created = False

            assert project_sdk is not None

            should_update_version = created or is_newer_version(
                sdk_version, project_sdk.sdk_version
            )

            if should_update_version:
                project_sdk.sdk_version = sdk_version
                project_sdk.save()
                cache.set(cache_key, project_sdk, 3600)

            return project_sdk


def is_newer_version(version_to_check: str, existing_version: str) -> bool:
    # quick check, if they're the same string, we don't need to do any
    # further validation as they are the same version
    if version_to_check == existing_version:
        return False

    try:
        new_version = parse_version(version_to_check)
    except InvalidVersion:
        # version to check is not valid semver version so it can't
        # be a newer version
        return False

    try:
        old_version = parse_version(existing_version)
    except InvalidVersion:
        # existing version is not valid semver version so the valid
        # version to check is always newer
        return True

    return new_version > old_version
