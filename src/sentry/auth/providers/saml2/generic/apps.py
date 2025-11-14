from typing import int
from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.saml2.generic"

    def ready(self) -> None:
        from sentry.auth import register

        from .provider import GenericSAML2Provider

        register(GenericSAML2Provider)
