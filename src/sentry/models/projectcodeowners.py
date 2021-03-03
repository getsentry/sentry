import logging

from django.db import models
from sentry.db.models import (
    FlexibleForeignKey,
    DefaultFieldsModel,
    JSONField,
)
from django.utils import timezone


logger = logging.getLogger(__name__)


class ProjectCodeOwners(DefaultFieldsModel):
    __core__ = False
    # no db constraint to prevent locks on the Project table
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    # repository_project_path_config ⇒ use this to transform CODEOWNERS paths to stacktrace paths
    repository_project_path_config = FlexibleForeignKey(
        "sentry.RepositoryProjectPathConfig", on_delete=models.PROTECT
    )
    # raw ⇒ original CODEOWNERS file.
    raw = models.TextField(null=True)
    # schema ⇒ transformed into IssueOwner syntax
    schema = JSONField(null=True)
    # override date_added from DefaultFieldsModel
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectcodeowners"
