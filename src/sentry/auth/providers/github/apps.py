from typing import int
from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.github"

    def ready(self) -> None:
        from sentry.auth import register

        from .provider import GitHubOAuth2Provider

        register(GitHubOAuth2Provider)
