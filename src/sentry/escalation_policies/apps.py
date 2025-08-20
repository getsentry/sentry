from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.escalation_policies"

    def ready(self) -> None:
        # Import any signals or other initialization code here if needed
        import sentry.escalation_policies.notifications  # NOQA
        import sentry.escalation_policies.tasks.escalation_check  # NOQA

        pass
