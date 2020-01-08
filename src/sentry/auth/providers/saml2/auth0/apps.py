from __future__ import absolute_import

from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.saml2.auth0"

    def ready(self):
        from sentry.auth import register

        from .provider import Auth0SAML2Provider

        register("auth0", Auth0SAML2Provider)
