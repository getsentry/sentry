from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.smokey"

    def ready(self):
        from sentry.smokey.models.incidentcase import IncidentCase  # NOQA
        from sentry.smokey.models.incidentcasetemplate import IncidentCaseTemplate  # NOQA
        from sentry.smokey.models.incidentcomponents import (  # NOQA
            IncidentCaseComponent,
            IncidentComponent,
        )
