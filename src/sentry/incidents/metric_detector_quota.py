from sentry import features, quotas
from sentry.auth.principal import RequestPrincipal
from sentry.constants import ObjectStatus
from sentry.models.organization import Organization
from sentry.workflow_engine.endpoints.validators.base import DetectorQuota
from sentry.workflow_engine.models import Detector
from sentry.workflow_engine.types import DetectorType

UNLIMITED = -1


def get_metric_detector_quota(
    organization: Organization, actor: RequestPrincipal | None = None
) -> DetectorQuota:
    limit = quotas.backend.get_metric_detector_limit(organization.id)
    if limit == UNLIMITED or not features.has(
        "organizations:workflow-engine-metric-detector-limit", organization, actor=actor
    ):
        return DetectorQuota(has_exceeded=False, limit=UNLIMITED, count=UNLIMITED)

    count = Detector.objects.filter(
        project__organization=organization,
        type=DetectorType.METRIC_ISSUE,
        status=ObjectStatus.ACTIVE,
        enabled=True,
    ).count()
    return DetectorQuota(has_exceeded=count >= limit, limit=limit, count=count)


def can_enable_metric_detectors(quota: DetectorQuota, count: int) -> bool:
    return quota.limit == UNLIMITED or quota.count + count <= quota.limit


def metric_detector_quota_message(quota: DetectorQuota) -> str:
    return f"Used {quota.count}/{quota.limit} of allowed {DetectorType.METRIC_ISSUE} monitors."
