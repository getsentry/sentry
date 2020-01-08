from __future__ import absolute_import

from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.saml2.onelogin"

    def ready(self):
        from sentry.auth import register

        from .provider import OneLoginSAML2Provider

        register("onelogin", OneLoginSAML2Provider)
