from typing import Any

import sentry_sdk

from sentry.models.organization import Organization
from sentry.signals import organization_created
from sentry.workflow_engine.defaults.detectors import (
    UnableToAcquireLockApiError,
    ensure_default_organization_detectors,
)
from sentry.workflow_engine.models import Detector


def create_organization_detectors(organization: Organization, **kwargs: Any) -> dict[str, Detector]:
    try:
        return ensure_default_organization_detectors(organization)
    except (UnableToAcquireLockApiError, Detector.MultipleObjectsReturned) as e:
        sentry_sdk.capture_exception(e)
    return {}


organization_created.connect(
    create_organization_detectors,
    dispatch_uid="create_organization_detectors",
    weak=False,
)
