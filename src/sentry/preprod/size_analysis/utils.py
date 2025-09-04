from sentry.preprod.models import PreprodArtifactSizeMetrics


# Build a mapping of (metrics_artifact_type, identifier) -> size metric for quick lookup of matching metrics from head or base size metrics
def build_size_metrics_map(metrics: list[PreprodArtifactSizeMetrics]):
    return {(metric.metrics_artifact_type, metric.identifier): metric for metric in metrics}
