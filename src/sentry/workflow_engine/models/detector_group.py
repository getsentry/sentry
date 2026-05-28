from collections.abc import Sequence
from typing import ClassVar, Self

from django.db import connections, models, router

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, cell_silo_model
from sentry.db.models.manager.base import BaseManager
from sentry.models.group import GroupStatus

OPEN_ISSUES_COUNT_CAP = 5000


def get_open_issues_counts(
    detector_ids: Sequence[int],
    cap: int = OPEN_ISSUES_COUNT_CAP,
) -> dict[int, int]:
    """
    Returns {detector_id: count} with count capped at `cap`.
    Uses LATERAL to stop scanning once the cap is reached per detector.
    """
    if not detector_ids:
        return {}

    sql = """
        SELECT d.detector_id, COUNT(*) AS open_issues_count
        FROM unnest(%s::bigint[]) AS d(detector_id)
        CROSS JOIN LATERAL (
            SELECT 1
            FROM workflow_engine_detectorgroup dg
            INNER JOIN sentry_groupedmessage g ON dg.group_id = g.id
            WHERE dg.detector_id = d.detector_id
              AND g.status = %s
            LIMIT %s
        ) sub
        GROUP BY d.detector_id
    """
    db = router.db_for_read(DetectorGroup)
    with connections[db].cursor() as cursor:
        cursor.execute(sql, [list(detector_ids), GroupStatus.UNRESOLVED, cap])
        return dict(cursor.fetchall())


@cell_silo_model
class DetectorGroup(DefaultFieldsModel):
    """
    A model to represent the relationship between a detector and a group.
    """

    __relocation_scope__ = RelocationScope.Excluded

    detector = FlexibleForeignKey("workflow_engine.Detector", null=True, on_delete=models.SET_NULL)
    group = FlexibleForeignKey("sentry.Group", on_delete=models.CASCADE)

    objects: ClassVar[BaseManager[Self]] = BaseManager(cache_fields=("pk", "group"))

    class Meta:
        db_table = "workflow_engine_detectorgroup"
        app_label = "workflow_engine"
        indexes = [
            models.Index(fields=["detector", "-date_added"], name="detectorgroup_det_date_idx"),
        ]
        unique_together = ("group",)
