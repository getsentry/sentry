from __future__ import absolute_import

from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.saml2.rippling"

    def ready(self):
        from sentry.auth import register

        from .provider import RipplingSAML2Provider

        register("rippling", RipplingSAML2Provider)
