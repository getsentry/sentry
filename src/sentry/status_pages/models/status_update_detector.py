from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, sane_repr
from sentry.db.models.base import Model


class StatusUpdateDetector(Model):
    """
    Join table between StatusUpdate and Detector models.
    """

    __relocation_scope__ = RelocationScope.Organization

    status_update = FlexibleForeignKey("status_pages.StatusUpdate")
    detector = FlexibleForeignKey("workflow_engine.Detector")

    class Meta:
        app_label = "status_pages"
        db_table = "sentry_status_update_detector"
        unique_together = (("status_update", "detector"),)

    __repr__ = sane_repr("status_update_id", "detector_id")
