from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.saml2.okta"

    def ready(self):
        from sentry.auth import register

        from .provider import OktaSAML2Provider

        register("okta", OktaSAML2Provider)
