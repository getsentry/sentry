from __future__ import annotations

import logging

from django.db.models.signals import pre_save

from sentry.models.release import ReleaseQuerySet

logger = logging.getLogger(__name__)


def parse_semver_pre_save(instance, **kwargs):
    if instance.id:
        return
    ReleaseQuerySet.massage_semver_cols_into_release_object_data(instance.__dict__)


pre_save.connect(
    parse_semver_pre_save, sender="sentry.Release", dispatch_uid="parse_semver_pre_save"
)
