"""Database models to keep track of the App Store Connect builds for a project.

For projects using the App Store Connect symbol source this keeps track of the last time we
did manage to check for available builds.
"""

from django.db import models
from django.utils import timezone

from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey


class LatestAppConnectBuildsCheck(DefaultFieldsModel):
    """
    The last date and time Sentry checked App Store Connect for new builds associated with a
    specific appconnect source in a project.
    """

    __include_in_export__ = False

    project = FlexibleForeignKey("sentry.Project", db_constraint=False)

    # The symbol source's unique identifier in the project. Also known as the id on an
    # AppStoreConnectConfig.
    source_id = models.CharField(max_length=200)

    # When sentry last checked App Store Connect for new builds. A check may return zero new builds,
    # or no builds at all if all existing builds have expired.
    last_checked = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_latestappconnectbuildscheck"
        unique_together = [("project", "source_id")]
