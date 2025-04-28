from django.apps import AppConfig


class Config(AppConfig):
    name = "sentry.auth.providers.oidc.okta"
    label = "okta_oidc"

    def ready(self):
        from sentry.auth import register

        from .provider import OktaOIDCProvider

        print(
            "------REGISTERING-----------------------------------------------------------------------------------------------------"
        )
        register("okta-oidc", OktaOIDCProvider)
