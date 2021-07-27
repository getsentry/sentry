"""Database models to keep track of the App Store Connect builds for a project.

If a project enables the App Store Connect source to download dSYMs directly from Apple we
need to keep track of which builds have already been downloaded.
"""

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model


class LatestAppConnectBuildsCheck(Model):
    """
    The last date and time Sentry checked App Store Connect for new builds associated with a
    specific appconnect source in a project.
    """

    __include_in_export__ = False

    project = FlexibleForeignKey("sentry.Project", db_constraint=False)

    # The symbol source's unique identifier in the project. Also known as the id on an
    # AppStoreConnectConfig.
    source_id = models.CharField(max_length=200, default="")

    # When sentry last checked App Store Connect.
    last_fetched = models.DateTimeField(default=timezone.now)

    @classmethod
    def refresh_date(cls, project, source_id):
        try:
            latest_check = cls.objects.get(project=project, source_id=source_id)
            latest_check.last_fetched = timezone.now()
            latest_check.save(update_fields=["last_fetched"])
        except cls.DoesNotExist:
            latest_check = LatestAppConnectBuildsCheck(
                project=project,
                source_id=source_id,
                last_fetched=timezone.now(),
            )
            latest_check.save()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_latestappconnectbuildscheck"
        unique_together = (("project", "source_id"),)
