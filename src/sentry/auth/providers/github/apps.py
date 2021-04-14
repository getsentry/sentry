from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.github"

    def ready(self):
        from sentry.auth import register

        from .provider import GitHubOAuth2Provider

        register("github", GitHubOAuth2Provider)
