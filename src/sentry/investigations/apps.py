from django.apps import AppConfig


class InvestigationsConfig(AppConfig):
    name = "sentry.investigations"

    def ready(self) -> None:
        from sentry.investigations.notebook_producer import OrchestrationProducer
        from sentry.investigations.services.action_kinds.connect_telemetry import (
            ConnectTelemetryKind,
        )
        from sentry.investigations.services.action_kinds.update_detector import UpdateDetectorKind
        from sentry.notebooks.models import NotebookSourceType
        from sentry.notebooks.services.action_kinds import register_action_kind
        from sentry.notebooks.services.producer import register_producer

        for kind in (UpdateDetectorKind(), ConnectTelemetryKind()):
            register_action_kind(kind)
        producer = OrchestrationProducer()
        # The engine runs manual prompts as well as metric open periods.
        for source_type in (NotebookSourceType.MANUAL, NotebookSourceType.METRIC_OPEN_PERIOD):
            register_producer(source_type, producer)
