from django.apps import AppConfig


class InvestigationsConfig(AppConfig):
    name = "sentry.investigations"

        from sentry.investigations.notebook_producer import OrchestrationProducer
        from sentry.investigations.services.action_kinds.connect_telemetry import (
            ConnectTelemetryKind,
        )
        from sentry.investigations.services.action_kinds.update_detector import UpdateDetectorKind
        from sentry.notebooks.services.action_kinds import register_action_kind
        from sentry.notebooks.services.producer import register_producer

