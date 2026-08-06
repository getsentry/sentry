from typing import Any

import sentry_sdk

from sentry import options
from sentry.models.organization import Organization
from sentry.signals import organization_created
from sentry.workflow_engine.defaults.detectors import (
    UnableToAcquireLockApiError,
    ensure_default_organization_detectors,
)


def create_organization_detectors(organization: Organization, **kwargs: Any) -> None:
    if not options.get("workflow_engine.all_projects_detector_creation_enabled"):
        return
    try:
        ensure_default_organization_detectors(organization)
    except UnableToAcquireLockApiError as e:
        sentry_sdk.capture_exception(e)


organization_created.connect(
    create_organization_detectors,
    dispatch_uid="create_organization_detectors",
    weak=False,
)
