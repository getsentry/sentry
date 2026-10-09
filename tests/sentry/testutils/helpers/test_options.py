from django.conf import settings

from sentry.testutils.helpers.options import override_options


def test_override_options_overrides_migrated_setting() -> None:
    with override_options({"slack.signing-secret": "signing-secret"}):
        assert settings.SENTRY_SLACK_SIGNING_SECRET == "signing-secret"
    assert settings.SENTRY_SLACK_SIGNING_SECRET != "signing-secret"


def test_override_options_overrides_existing_mapped_settings() -> None:
    with override_options({"github-login.client-id": "login-client-id", "mail.backend": "dummy"}):
        assert settings.GITHUB_APP_ID == "login-client-id"
        assert settings.EMAIL_BACKEND == "dummy"


def test_override_options_restores_nested_deployment_settings() -> None:
    original = settings.SENTRY_GITHUB_APP_CLIENT_ID
    with override_options({"github-app.client-id": "outer-client-id"}):
        assert settings.SENTRY_GITHUB_APP_CLIENT_ID == "outer-client-id"
        with override_options({"github-app.client-id": "inner-client-id"}):
            assert settings.SENTRY_GITHUB_APP_CLIENT_ID == "inner-client-id"
        assert settings.SENTRY_GITHUB_APP_CLIENT_ID == "outer-client-id"
    assert settings.SENTRY_GITHUB_APP_CLIENT_ID == original
