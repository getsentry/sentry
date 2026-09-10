from typing import Any

from django.db import router, transaction

from sentry.models.project import Project
from sentry.signals import project_created
from sentry.workflow_engine.defaults.workflows import ensure_default_workflows
from sentry.workflow_engine.models import Workflow


def create_default_workflows(
    project: Project,
    default_rules: bool = True,
    **kwargs: Any,
) -> None:
    if not default_rules:
        return

    with transaction.atomic(router.db_for_write(Workflow)):
        ensure_default_workflows(project)


project_created.connect(
    create_default_workflows,
    dispatch_uid="create_default_workflows",
    weak=False,
)
