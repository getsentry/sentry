from sentry.sentry_metrics.kafka import KafkaMetricsBackend
from sentry.sentry_metrics.use_case_id_registry import UseCaseID


# a sample test to run locally to check
# whether metrics are being produced
# to the ingest-performance-metrics Kafka topic
def test_emit() -> None:
    metrics_backend = KafkaMetricsBackend()

    use_case_id = UseCaseID.TRANSACTIONS
    org_id = 5
    project_id = 1
    metric_name = "sample_metric"
    values = [2, 3]
    tags = {"a": "b"}

    metrics_backend.set(
        use_case_id,
        org_id,
        project_id,
        metric_name,
        values,
        tags,
        unit=None,
    )

    metrics_backend.close()
