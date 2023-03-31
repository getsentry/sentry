from __future__ import annotations

from typing import Any

from django.dispatch import receiver

from sentry.models import (
    ApiApplication,
    Integration,
    OutboxCategory,
    SentryAppInstallation,
    User,
    process_control_outbox,
)
from sentry.receivers.outbox import maybe_process_tombstone


@receiver(process_control_outbox, sender=OutboxCategory.USER_UPDATE)
def process_user_updates(object_identifier: int, **kwds: Any):
    if (user := maybe_process_tombstone(User, object_identifier)) is None:
        return
    user  # Currently we do not sync any other user changes, but if we did, you can use this variable.


@receiver(process_control_outbox, sender=OutboxCategory.INTEGRATION_UPDATE)
def process_integration_updates(object_identifier: int, **kwds: Any):
    if (integration := maybe_process_tombstone(Integration, object_identifier)) is None:
        return
    integration  # Currently we do not sync any other integration changes, but if we did, you can use this variable.


@receiver(process_control_outbox, sender=OutboxCategory.API_APPLICATION_UPDATE)
def process_api_application_updates(object_identifier: int, **kwds: Any):
    if (api_application := maybe_process_tombstone(ApiApplication, object_identifier)) is None:
        return
    api_application  # Currently we do not sync any other api application changes, but if we did, you can use this variable.


@receiver(process_control_outbox, sender=OutboxCategory.SENTRY_APP_INSTALLATION_UPDATE)
def process_sentry_app_installation_updates(object_identifier: int, **kwds: Any):
    if (
        sentry_app_installation := maybe_process_tombstone(SentryAppInstallation, object_identifier)
    ) is None:
        return
    sentry_app_installation  # Currently we do not sync any other api application changes, but if we did, you can use this variable.
