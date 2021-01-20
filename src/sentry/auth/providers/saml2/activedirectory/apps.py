from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.saml2.activedirectory"

    def ready(self):
        from sentry.auth import register

        from .provider import ActiveDirectorySAML2Provider

        register("active-directory", ActiveDirectorySAML2Provider)
