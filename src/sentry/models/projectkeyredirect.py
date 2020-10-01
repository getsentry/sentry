from __future__ import absolute_import, print_function

from django.db import models

from sentry.db.models import (
    Model,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
)


class ProjectKeyRedirect(Model):
    __core__ = True

    project_key = FlexibleForeignKey("sentry.ProjectKey", related_name="redirect_set")
    from_project_id = BoundedPositiveIntegerField(null=False, db_index=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectkeyredirect"
        unique_together = (("project_key", "from_project_id"),)
