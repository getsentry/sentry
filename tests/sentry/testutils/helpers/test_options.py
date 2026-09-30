from django.conf import settings

from sentry.testutils.helpers.options import override_options


def test_override_options_overrides_migrated_setting() -> None:
    with override_options({"slack.signing-secret": "signing-secret"}):
        assert settings.SENTRY_SLACK_SIGNING_SECRET == "signing-secret"
    assert settings.SENTRY_SLACK_SIGNING_SECRET != "signing-secret"
