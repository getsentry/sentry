from __future__ import annotations

import logging
from collections.abc import Sequence
from enum import Enum

import sentry_sdk
from django.db import models
from packaging.version import InvalidVersion, Version
from packaging.version import parse as parse_version

from sentry import options
from sentry.backup.scopes import RelocationScope
from sentry.db.models import BoundedIntegerField, FlexibleForeignKey, region_silo_model, sane_repr
from sentry.db.models.base import DefaultFieldsModel
from sentry.locks import locks
from sentry.models.project import Project
from sentry.sdk_updates import get_sdk_index
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.hashlib import md5_text

logger = logging.getLogger(__name__)


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
    def get_lock_key(cls, project: Project, event_type: EventType, sdk_name: str):
        return f"lprojectsdk:{project.id}:{event_type.value}:{md5_text(sdk_name).hexdigest()}"

    @classmethod
    def get_cache_key(cls, project: Project, event_type: EventType, sdk_name: str):
        return f"projectsdk:{project.id}:{event_type.value}:{md5_text(sdk_name).hexdigest()}"

    @classmethod
    def update_with_newest_version_or_create(
        cls,
        project: Project,
        event_type: EventType,
        sdk_name: str,
        sdk_version: str,
    ):
        try:
            new_version = parse_version(sdk_version)
        except InvalidVersion:
            # non-semver sdk version, ignore and move on
            return

        normalized_sdk_name = normalize_sdk_name(sdk_name)
        if normalized_sdk_name is None:
            logger.info("Unknown sdk name: %s", sdk_name)
            return

        lock_key = cls.get_lock_key(project, event_type, normalized_sdk_name)
        lock = locks.get(lock_key, duration=10, name="projectsdk")

        # This can raise `sentry.utils.locking.UnableToAcquireLock`
        # that needs to be handled by the caller and handled
        # appropriately with retries if needed.
        with lock.acquire():
            cls.__update_with_newest_version_or_create(
                project,
                event_type,
                normalized_sdk_name,
                sdk_version,
                new_version,
            )

    @classmethod
    def __update_with_newest_version_or_create(
        cls,
        project: Project,
        event_type: EventType,
        sdk_name: str,
        sdk_version: str,
        new_version: Version,
    ):
        cache_key = cls.get_cache_key(project, event_type, sdk_name)

        with metrics.timer(
            "models.projectsdk.update_with_newest_version_or_create"
        ) as metrics_tags:
            project_sdk = cache.get(cache_key)

            if project_sdk is None:
                metrics_tags["cache_hit"] = "false"
                project_sdk, created = cls.objects.get_or_create(
                    project=project,
                    event_type=event_type.value,
                    sdk_name=sdk_name,
                    defaults={"sdk_version": sdk_version},
                )
                should_update_cache = True
            else:
                metrics_tags["cache_hit"] = "true"
                should_update_cache = False

            assert project_sdk is not None

            if sdk_version != project_sdk.sdk_version:
                try:
                    old_version = parse_version(project_sdk.sdk_version)
                except InvalidVersion:
                    # non-semver sdk version, always overwrite
                    old_version = None

                if old_version is None or old_version < new_version:
                    project_sdk.sdk_version = sdk_version
                    project_sdk.save()
                    should_update_cache = True

            if should_update_cache:
                cache.set(cache_key, project_sdk, 3600)


LEGACY_SDK_NAMES: set[str] = {
    "sentry.javascript.serverless",
}


def normalize_sdk_name(sdk_name: str) -> str | None:
    sdk_index = get_sdk_index()

    # usually, the sdk names reported will match
    # exactly what's in the registry
    if sdk_name in sdk_index:
        return sdk_name

    # some legacy sdks are not present in the registry
    # and will not be backfilled, so check them here
    if sdk_name in LEGACY_SDK_NAMES:
        return sdk_name

    # some sdks suffix the name depending on the integrations
    # that are in use, so try to normalize it to the registry name
    parts = sdk_name.split(".", 2)
    if len(parts) < 2:
        # already in its normalized form
        return None

    # The name in the registry is just the first 2 parts of the
    # reported name joined by a `.`
    sdk_name = ".".join(parts[:2])
    if sdk_name in sdk_index:
        return sdk_name

    return None


MINIMUM_SDK_VERSION_OPTIONS: dict[tuple[int, str], str] = {
    (EventType.PROFILE_CHUNK.value, "sentry.cocoa"): "sdk-deprecation.profile-chunk.cocoa",
    (EventType.PROFILE_CHUNK.value, "sentry.python"): "sdk-deprecation.profile-chunk.python",
}


def get_minimum_sdk_version(event_type: int, sdk_name: str, hard_limit: bool) -> Version | None:
    parts = sdk_name.split(".", 2)
    if len(parts) < 2:
        return None

    normalized_sdk_name = ".".join(parts[:2])

    sdk_version_option = MINIMUM_SDK_VERSION_OPTIONS.get((event_type, normalized_sdk_name))
    if sdk_version_option is None:
        return None

    if hard_limit:
        sdk_version = options.get(f"{sdk_version_option}.hard")
    else:
        sdk_version = options.get(sdk_version_option)

    if sdk_version:
        try:
            return parse_version(sdk_version)
        except InvalidVersion as e:
            sentry_sdk.capture_exception(e)
    return None
