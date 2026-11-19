"""Issue Platform type for correlated anomalies."""

from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.workflow_engine.types import DetectorType


class AnomalyDetection(GroupType):
    type_id = 14001
    slug = DetectorType.ANOMALY_DETECTION.value
    description = "Detected Anomaly"
    category = GroupCategory.METRIC.value
    released = False
    enable_auto_resolve = False
    enable_escalation_detection = False
