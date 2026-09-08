import logging
from typing import Any

import sentry_sdk

from sentry.models.organization import Organization
from sentry.signals import organization_created
from sentry.workflow_engine.defaults.detectors import (
    UnableToAcquireLockApiError,
    ensure_default_organization_detectors,
)
from sentry.workflow_engine.models import Detector

logger = logging.getLogger(__name__)


def create_organization_detectors(organization: Organization, **kwargs: Any) -> dict[str, Detector]:
    log_name = "organization_created.create_organization_detectors"
    log_extra = {"organization_id": organization.id}
    logger.info(f"{log_name}.start", extra=log_extra)
    try:
        results = ensure_default_organization_detectors(organization)
        logger.info(
            f"{log_name}.success",
            extra={
                **log_extra,
                "detector_ids": [detector.id for detector in results.values()],
            },
        )
        return results
    except (UnableToAcquireLockApiError, Detector.MultipleObjectsReturned) as e:
        sentry_sdk.capture_exception(e)
        logger.info(f"{log_name}.failure", extra=log_extra, exc_info=e)
    return {}


organization_created.connect(
    create_organization_detectors,
    dispatch_uid="create_organization_detectors",
    weak=False,
)
