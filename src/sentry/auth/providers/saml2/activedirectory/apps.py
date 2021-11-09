from django.apps import AppConfig

ACTIVE_DIRECTORY_PROVIDER_NAME = "active-directory"


class Config(AppConfig):
    name = "sentry.auth.providers.saml2.activedirectory"

    def ready(self):
        from sentry.auth import register

        from .provider import ActiveDirectorySAML2Provider

        register(ACTIVE_DIRECTORY_PROVIDER_NAME, ActiveDirectorySAML2Provider)
