from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, sane_repr
from sentry.db.models.base import DefaultFieldsModelExisting, region_silo_model


@region_silo_model
class StatusPageDetector(DefaultFieldsModelExisting):
    """
    Join table between StatusPage and Detector models.
    """

    __relocation_scope__ = RelocationScope.Organization

    status_page = FlexibleForeignKey("status_pages.StatusPage")
    detector = FlexibleForeignKey("workflow_engine.Detector")

    class Meta:
        app_label = "status_pages"
        db_table = "sentry_status_page_detector"
        unique_together = (("status_page", "detector"),)

    __repr__ = sane_repr("status_page_id", "detector_id")
