from datetime import datetime

from sentry.anomaly_detection.contracts import AnomalyGroupKey, ChangeEvent, ChangeType, Urgency
from sentry.anomaly_detection.evaluation.organization import AnomalyDecision, AnomalyEvidence


class NoFootprints:
    """A footprint source for evaluations that need no trace evidence."""

    def footprint(self, event: ChangeEvent, observation_end: datetime, /) -> None:
        return None


def anomaly_decision(
    project_id: int,
    timestamp: datetime,
    *,
    group_key: str = "group",
    urgency: Urgency = Urgency.MEDIUM,
    is_resolved: bool = False,
    title: str = "Errors increased",
    evidence: AnomalyEvidence | None = None,
    env: str = "production",
) -> AnomalyDecision:
    return AnomalyDecision(
        group_key=AnomalyGroupKey(group_key),
        project_id=project_id,
        timestamp=timestamp,
        urgency=urgency,
        is_resolved=is_resolved,
        title=title,
        evidence=evidence
        or {
            "signal": "errors",
            "change_type": ChangeType.SPIKE,
            "started_at": timestamp.isoformat(),
        },
        env=env,
    )
