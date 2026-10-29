from django.apps import AppConfig


class SeerAutomationsConfig(AppConfig):
    name = "sentry.seer_automations"

    def ready(self) -> None:
        import sentry.seer_automations.workflows.action  # noqa: F401
        from sentry.seer.agent.feature_delivery import DELIVERY_HANDLERS
        from sentry.seer_automations.agentic_triage.delivery import deliver_agentic_triage_result
        from sentry.seer_automations.monitor_cleanup.runs import deliver_monitor_cleanup_result

        DELIVERY_HANDLERS.update(
            {
                "night_shift": deliver_agentic_triage_result,
                "monitor_cleanup": deliver_monitor_cleanup_result,
            }
        )
