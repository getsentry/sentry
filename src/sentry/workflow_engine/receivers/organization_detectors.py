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
    logging_name = "organization_created.create_organization_detectors"
    logging_extra = {"organization_id": organization.id}
    logging.info(f"{logging_name}.start", extra=logging_extra)
    try:
        results = ensure_default_organization_detectors(organization)
        logging.info(
            f"{logging_name}.success",
            extra={
                **logging_extra,
                "detector_ids": [detector.id for detector in results.values()],
            },
        )
        return results
    except (UnableToAcquireLockApiError, Detector.MultipleObjectsReturned) as e:
        sentry_sdk.capture_exception(e)
        logging.info(f"{logging_name}.failure", extra=logging_extra, exc_info=e)
    return {}


organization_created.connect(
    create_organization_detectors,
    dispatch_uid="create_organization_detectors",
    weak=False,
)
