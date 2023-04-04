from sentry_metrics.use_case_registry import UseCaseID


class GenericMetricsInterface:
    def emit_counter(
        use_case_id: UseCaseID, org_id: int, project_id: int, metric_name: str, value: int, tags
    ):
        raise NotImplementedError

    def emit_set(
        use_case_id: UseCaseID, org_id: int, project_id: int, metric_name: str, value: int, tags
    ):
        raise NotImplementedError

    def emit_distribution(
        use_case_id: UseCaseID, org_id: int, project_id: int, metric_name: str, value: int, tags
    ):
        raise NotImplementedError
