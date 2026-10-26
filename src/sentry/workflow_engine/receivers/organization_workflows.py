import logging
from typing import Any

import sentry_sdk

from sentry.models.organization import Organization
from sentry.signals import organization_created
from sentry.workflow_engine.defaults.detectors import (
    UnableToAcquireLockApiError,
)
from sentry.workflow_engine.defaults.workflows import ensure_default_organization_workflows
from sentry.workflow_engine.models import Detector, Workflow

logger = logging.getLogger(__name__)


def create_organization_workflows(organization: Organization, **kwargs: Any) -> None:
    logger.info(
        "organization_created.create_organization_workflows.start",
        extra={"organization_id": organization.id},
    )
    try:
        workflows = ensure_default_organization_workflows(organization)
        logger.info(
            "organization_created.create_organization_workflows.success",
            extra={
                "organization_id": organization.id,
                "workflow_ids": [workflow.id for workflow in workflows],
            },
        )
    except (
        UnableToAcquireLockApiError,
        Detector.MultipleObjectsReturned,
        Workflow.MultipleObjectsReturned,
    ) as e:
        sentry_sdk.capture_exception(e)
        logger.info(
            "organization_created.create_organization_workflows.failure",
            extra={"organization_id": organization.id},
            exc_info=e,
        )


organization_created.connect(
    create_organization_workflows,
    dispatch_uid="create_organization_workflows",
    weak=False,
)
