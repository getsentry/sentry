from typing import Any

import sentry_sdk

from sentry import options
from sentry.models.organization import Organization
from sentry.signals import organization_created
from sentry.workflow_engine.defaults.detectors import (
    UnableToAcquireLockApiError,
)
from sentry.workflow_engine.defaults.workflows import ensure_default_organization_workflows


def create_organization_workflows(organization: Organization, **kwargs: Any) -> None:
    if not options.get("workflow_engine.all_projects_auto_creation_enabled"):
        return
    try:
        ensure_default_organization_workflows(organization)
    except UnableToAcquireLockApiError as e:
        sentry_sdk.capture_exception(e)


organization_created.connect(
    create_organization_workflows,
    dispatch_uid="create_organization_workflows",
    weak=False,
)
