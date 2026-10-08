import types
from unittest.mock import patch

import pytest
from django.core.cache import caches
from django.test import override_settings

from sentry.hybridcloud.models.outbox import CellOutboxBase
from sentry.issues.models.groupactionlogoutbox import GroupActionLogOutbox
from sentry.options import default_store
from sentry.runner.initializer import (
    ConfigurationError,
    apply_legacy_settings,
    bind_cache_to_option_store,
    bootstrap_options,
    validate_options,
    validate_outbox_config,
)
from sentry.utils.warnings import DeprecatedSettingWarning


@pytest.fixture
def settings():
    return types.SimpleNamespace(
        TIME_ZONE="UTC",
        ALLOWED_HOSTS=[],
        SENTRY_FEATURES={},
        SENTRY_OPTIONS={},
        SENTRY_DEFAULT_OPTIONS={},
        SENTRY_EMAIL_BACKEND_ALIASES={"dummy": "alias-for-dummy"},
        SENTRY_SELF_HOSTED=False,
        SENTRY_SINGLE_ORGANIZATION=False,
        SENTRY_GITHUB_APP_CLIENT_ID="",
    )


@pytest.fixture
def config_yml(tmpdir):
    return tmpdir.join("config.yml")


def _assert_settings_warnings(warninfo, expected):
    actual = {(w.message.setting, w.message.replacement) for w in warninfo}
    assert actual == expected


def test_bootstrap_options_simple(settings, config_yml) -> None:
    "Config options are specified in both places, but config.yml should prevail"
    settings.SECRET_KEY = "xxx"
    settings.EMAIL_BACKEND = "xxx"
    settings.EMAIL_HOST = "xxx"
    settings.EMAIL_PORT = 6969
    settings.EMAIL_HOST_USER = "xxx"
    settings.EMAIL_HOST_PASSWORD = "xxx"
    settings.EMAIL_USE_TLS = False
    settings.EMAIL_USE_SSL = False
    settings.SERVER_EMAIL = "xxx"
    settings.EMAIL_SUBJECT_PREFIX = "xxx"
    settings.SENTRY_OPTIONS = {"something.else": True}

    config_yml.write(
        """\
foo.bar: my-foo-bar
system.secret-key: my-system-secret-key
mail.backend: my-mail-backend
mail.host: my-mail-host
mail.port: 123
mail.username: my-mail-username
mail.password: my-mail-password
mail.use-tls: true
mail.use-ssl: false
mail.from: my-mail-from
mail.subject-prefix: my-mail-subject-prefix
"""
    )

    bootstrap_options(settings, str(config_yml))
    assert settings.SENTRY_OPTIONS == {
        "something.else": True,
        "foo.bar": "my-foo-bar",
        "system.secret-key": "my-system-secret-key",
        "mail.backend": "my-mail-backend",
        "mail.host": "my-mail-host",
        "mail.port": 123,
        "mail.username": "my-mail-username",
        "mail.password": "my-mail-password",
        "mail.use-tls": True,
        "mail.use-ssl": False,
        "mail.from": "my-mail-from",
        "mail.subject-prefix": "my-mail-subject-prefix",
    }
    assert settings.SECRET_KEY == "my-system-secret-key"
    assert settings.EMAIL_BACKEND == "my-mail-backend"
    assert settings.EMAIL_HOST == "my-mail-host"
    assert settings.EMAIL_PORT == 123
    assert settings.EMAIL_HOST_USER == "my-mail-username"
    assert settings.EMAIL_HOST_PASSWORD == "my-mail-password"
    assert settings.EMAIL_USE_TLS is True
    assert settings.EMAIL_USE_SSL is False
    assert settings.SERVER_EMAIL == "my-mail-from"
    assert settings.EMAIL_SUBJECT_PREFIX == "my-mail-subject-prefix"


def test_bootstrap_options_malformed_yml(settings, config_yml) -> None:
    config_yml.write("1")
    with pytest.raises(ConfigurationError):
        bootstrap_options(settings, str(config_yml))

    config_yml.write("{{{")
    with pytest.raises(ConfigurationError):
        bootstrap_options(settings, str(config_yml))


def test_bootstrap_options_no_config(settings) -> None:
    "No config file should gracefully extract values out of settings"
    settings.SECRET_KEY = "my-system-secret-key"
    settings.EMAIL_BACKEND = "my-mail-backend"
    settings.EMAIL_HOST = "my-mail-host"
    settings.EMAIL_PORT = 123
    settings.EMAIL_HOST_USER = "my-mail-username"
    settings.EMAIL_HOST_PASSWORD = "my-mail-password"
    settings.EMAIL_USE_TLS = True
    settings.EMAIL_USE_SSL = False
    settings.SERVER_EMAIL = "my-mail-from"
    settings.EMAIL_SUBJECT_PREFIX = "my-mail-subject-prefix"
    settings.FOO_BAR = "lol"

    with pytest.warns(DeprecatedSettingWarning) as warninfo:
        bootstrap_options(settings)
    _assert_settings_warnings(
        warninfo,
        {
            ("EMAIL_BACKEND", "SENTRY_OPTIONS['mail.backend']"),
            ("EMAIL_HOST", "SENTRY_OPTIONS['mail.host']"),
            ("EMAIL_HOST_PASSWORD", "SENTRY_OPTIONS['mail.password']"),
            ("EMAIL_HOST_USER", "SENTRY_OPTIONS['mail.username']"),
            ("EMAIL_PORT", "SENTRY_OPTIONS['mail.port']"),
            ("EMAIL_SUBJECT_PREFIX", "SENTRY_OPTIONS['mail.subject-prefix']"),
            ("EMAIL_USE_SSL", "SENTRY_OPTIONS['mail.use-ssl']"),
            ("EMAIL_USE_TLS", "SENTRY_OPTIONS['mail.use-tls']"),
            ("SECRET_KEY", "SENTRY_OPTIONS['system.secret-key']"),
            ("SERVER_EMAIL", "SENTRY_OPTIONS['mail.from']"),
        },
    )
    assert settings.SENTRY_OPTIONS == {
        "system.secret-key": "my-system-secret-key",
        "mail.backend": "my-mail-backend",
        "mail.host": "my-mail-host",
        "mail.port": 123,
        "mail.username": "my-mail-username",
        "mail.password": "my-mail-password",
        "mail.use-tls": True,
        "mail.use-ssl": False,
        "mail.from": "my-mail-from",
        "mail.subject-prefix": "my-mail-subject-prefix",
    }


def test_bootstrap_options_no_config_only_sentry_options(settings) -> None:
    "SENTRY_OPTIONS is only declared, but should be promoted into settings"
    settings.SENTRY_OPTIONS = {
        "system.secret-key": "my-system-secret-key",
        "mail.backend": "my-mail-backend",
        "mail.host": "my-mail-host",
        "mail.port": 123,
        "mail.username": "my-mail-username",
        "mail.password": "my-mail-password",
        "mail.use-tls": True,
        "mail.use-ssl": False,
        "mail.from": "my-mail-from",
        "mail.subject-prefix": "my-mail-subject-prefix",
    }

    bootstrap_options(settings)
    assert settings.SECRET_KEY == "my-system-secret-key"
    assert settings.EMAIL_BACKEND == "my-mail-backend"
    assert settings.EMAIL_HOST == "my-mail-host"
    assert settings.EMAIL_PORT == 123
    assert settings.EMAIL_HOST_USER == "my-mail-username"
    assert settings.EMAIL_HOST_PASSWORD == "my-mail-password"
    assert settings.EMAIL_USE_TLS is True
    assert settings.EMAIL_USE_SSL is False
    assert settings.SERVER_EMAIL == "my-mail-from"
    assert settings.EMAIL_SUBJECT_PREFIX == "my-mail-subject-prefix"


def test_bootstrap_options_mail_aliases(settings) -> None:
    settings.SENTRY_OPTIONS = {"mail.backend": "dummy"}
    bootstrap_options(settings)
    assert settings.EMAIL_BACKEND == "alias-for-dummy"


def test_bootstrap_options_missing_file(settings) -> None:
    bootstrap_options(settings, "this-file-does-not-exist-xxxxxxxxxxxxxx.yml")
    assert settings.SENTRY_OPTIONS == {}


def test_bootstrap_options_empty_file(settings, config_yml) -> None:
    config_yml.write("")
    bootstrap_options(settings, str(config_yml))
    assert settings.SENTRY_OPTIONS == {}


def test_apply_legacy_settings(settings) -> None:
    settings.ALLOWED_HOSTS = []
    settings.SENTRY_USE_QUEUE = True
    settings.SENTRY_ALLOW_REGISTRATION = True
    settings.SENTRY_ADMIN_EMAIL = "admin-email"
    settings.SENTRY_REDIS_OPTIONS = {"foo": "bar"}
    settings.SENTRY_ENABLE_EMAIL_REPLIES = True
    settings.SENTRY_SMTP_HOSTNAME = "reply-hostname"
    settings.MAILGUN_API_KEY = "mailgun-api-key"
    settings.SENTRY_OPTIONS = {"system.secret-key": "secret-key", "mail.from": "mail-from"}
    settings.SENTRY_FILESTORE = "some-filestore"
    settings.SENTRY_FILESTORE_OPTIONS = {"filestore-foo": "filestore-bar"}
    settings.SENTRY_FILESTORE_RELOCATION = {"relocation-baz": "relocation-qux"}
    settings.SENTRY_RELOCATION_BACKEND = "some-other-filestore"
    settings.SENTRY_RELOCATION_OPTIONS = {"relocation-baz": "relocation-qux"}
    with pytest.warns(DeprecatedSettingWarning) as warninfo:
        apply_legacy_settings(settings)
    assert settings.SENTRY_FEATURES["auth:register"] is True
    assert settings.SENTRY_OPTIONS == {
        "system.admin-email": "admin-email",
        "system.secret-key": "secret-key",
        "redis.clusters": {"default": {"foo": "bar"}},
        "mail.from": "mail-from",
        "mail.enable-replies": True,
        "mail.reply-hostname": "reply-hostname",
        "mail.mailgun-api-key": "mailgun-api-key",
        "filestore.backend": "some-filestore",
        "filestore.options": {"filestore-foo": "filestore-bar"},
        "filestore.relocation-backend": "some-other-filestore",
        "filestore.relocation-options": {"relocation-baz": "relocation-qux"},
    }
    assert settings.SENTRY_MAILGUN_API_KEY == "mailgun-api-key"
    assert settings.DEFAULT_FROM_EMAIL == "mail-from"
    assert settings.ALLOWED_HOSTS == ["*"]

    _assert_settings_warnings(
        warninfo,
        {
            ("MAILGUN_API_KEY", "SENTRY_OPTIONS['mail.mailgun-api-key']"),
            ("SENTRY_ADMIN_EMAIL", "SENTRY_OPTIONS['system.admin-email']"),
            ("SENTRY_ALLOW_REGISTRATION", 'SENTRY_FEATURES["auth:register"]'),
            ("SENTRY_ENABLE_EMAIL_REPLIES", "SENTRY_OPTIONS['mail.enable-replies']"),
            ("SENTRY_FILESTORE", "SENTRY_OPTIONS['filestore.backend']"),
            ("SENTRY_FILESTORE_OPTIONS", "SENTRY_OPTIONS['filestore.options']"),
            ("SENTRY_RELOCATION_BACKEND", "SENTRY_OPTIONS['filestore.relocation-backend']"),
            (
                "SENTRY_RELOCATION_OPTIONS",
                "SENTRY_OPTIONS['filestore.relocation-options']",
            ),
            ("SENTRY_REDIS_OPTIONS", 'SENTRY_OPTIONS["redis.clusters"]'),
            ("SENTRY_SMTP_HOSTNAME", "SENTRY_OPTIONS['mail.reply-hostname']"),
        },
    )


def test_initialize_app(settings) -> None:
    "Just a sanity check of the full initialization process"
    settings.SENTRY_OPTIONS = {"system.secret-key": "secret-key"}
    bootstrap_options(settings)
    apply_legacy_settings(settings)


def test_validate_outbox_config_includes_group_action_log_outbox() -> None:
    with patch.object(CellOutboxBase, "from_outbox_name") as validate_cell_outbox:
        validate_outbox_config()

    validate_cell_outbox.assert_any_call(GroupActionLogOutbox._meta.label)


def test_require_secret_key(settings) -> None:
    assert "system.secret-key" not in settings.SENTRY_OPTIONS
    with pytest.raises(ConfigurationError):
        apply_legacy_settings(settings)


def test_bind_cache_to_option_store_with_options_cache() -> None:
    from django.conf import settings

    cache_config = settings.CACHES.copy()
    cache_config["options"] = {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
    }

    with override_settings(CACHES=cache_config):
        bind_cache_to_option_store()

        # Should use 'options' cache, not 'default'
        assert default_store.cache == caches["options"]


def test_self_hosted_filestore_config_yml_promoted(settings, config_yml) -> None:
    """config.yml filestore keys are promoted to Django settings on self-hosted."""
    settings.SENTRY_SELF_HOSTED = True
    settings.SENTRY_FILE_STORAGE_BACKEND = "filesystem"
    settings.SENTRY_FILE_STORAGE_CONFIG = {}

    config_yml.write("filestore.backend: gcs\nfilestore.options:\n  bucket_name: my-bucket\n")
    bootstrap_options(settings, str(config_yml))

    assert settings.SENTRY_FILE_STORAGE_BACKEND == "gcs"
    assert settings.SENTRY_FILE_STORAGE_CONFIG == {"bucket_name": "my-bucket"}


def test_non_self_hosted_filestore_config_yml_not_promoted(settings, config_yml) -> None:
    """config.yml filestore keys are not promoted to Django settings on SaaS."""
    settings.SENTRY_SELF_HOSTED = False
    settings.SENTRY_FILE_STORAGE_BACKEND = "filesystem"
    settings.SENTRY_FILE_STORAGE_CONFIG = {}

    config_yml.write("filestore.backend: gcs\nfilestore.options:\n  bucket_name: my-bucket\n")
    bootstrap_options(settings, str(config_yml))

    assert settings.SENTRY_FILE_STORAGE_BACKEND == "filesystem"
    assert settings.SENTRY_FILE_STORAGE_CONFIG == {}


def test_migrated_options_promoted(settings, config_yml) -> None:
    """Configured values for migrated options reach their settings in every mode."""
    settings.SENTRY_SLACK_SIGNING_SECRET = ""
    settings.SENTRY_GITHUB_APP_WEBHOOK_SECRET = ""
    settings.SENTRY_OPTIONS = {"github-app.webhook-secret": "webhook-secret"}

    config_yml.write("slack.signing-secret: signing-secret\n")
    bootstrap_options(settings, str(config_yml))

    assert settings.SENTRY_SLACK_SIGNING_SECRET == "signing-secret"
    assert settings.SENTRY_GITHUB_APP_WEBHOOK_SECRET == "webhook-secret"


def test_migrated_options_defaults_not_promoted(settings) -> None:
    """A registered option default never replaces a directly configured setting."""
    settings.SENTRY_SLACK_SIGNING_SECRET = "signing-secret"
    settings.SENTRY_DEFAULT_OPTIONS = {"slack.signing-secret": ""}

    bootstrap_options(settings)

    assert settings.SENTRY_SLACK_SIGNING_SECRET == "signing-secret"
    assert "slack.signing-secret" not in settings.SENTRY_OPTIONS


def test_single_organization_reuses_github_app_secret(settings) -> None:
    """Single organization SSO uses the GitHub integration app secret setting."""
    settings.SENTRY_SINGLE_ORGANIZATION = True
    settings.SENTRY_GITHUB_APP_CLIENT_SECRET = "app-secret"
    settings.SENTRY_OPTIONS = {"github-login.client-secret": "login-secret"}

    bootstrap_options(settings)

    assert settings.GITHUB_API_SECRET == "app-secret"


def test_single_organization_keeps_option_github_secret_remap(settings) -> None:
    """With the option key configured, the single organization remap decides the SSO secret."""
    settings.SENTRY_SINGLE_ORGANIZATION = True
    settings.SENTRY_OPTIONS = {
        "github-app.client-secret": "app-secret",
        "github-login.client-secret": "login-secret",
    }

    with patch.dict(
        "sentry.runner.initializer.options_mapper",
        {"github-app.client-id": "GITHUB_APP_ID", "github-app.client-secret": "GITHUB_API_SECRET"},
    ):
        bootstrap_options(settings)

    assert settings.GITHUB_API_SECRET == "login-secret"
    assert settings.SENTRY_GITHUB_APP_CLIENT_SECRET == "app-secret"


def test_self_hosted_validate_options_skips_migrated_keys(settings) -> None:
    """validate_options does not warn about migrated option keys on self-hosted."""
    settings.SENTRY_SELF_HOSTED = True
    settings.SENTRY_OPTIONS = {"filestore.backend": "gcs", "mail.list-namespace": "example.com"}

    # Should not raise UnknownOption or emit warnings for the migrated keys.
    import warnings as _warnings

    with _warnings.catch_warnings():
        _warnings.simplefilter("error")
        validate_options(settings)


def test_bind_cache_to_option_store_without_options_cache() -> None:
    from django.conf import settings

    cache_config = settings.CACHES.copy()
    cache_config.pop("options", None)

    with override_settings(CACHES=cache_config):
        bind_cache_to_option_store()

        # Should use 'default' cache when 'options' doesn't exist
        assert default_store.cache == caches["default"]


DEPLOYMENT_OPTION_CASES = [
    ("auth-fly.client-secret", "SENTRY_AUTH_FLY_CLIENT_SECRET", "configured-value"),
    ("auth-google.client-secret", "SENTRY_AUTH_GOOGLE_CLIENT_SECRET", "configured-value"),
    ("aws-lambda.secret-access-key", "SENTRY_AWS_LAMBDA_SECRET_ACCESS_KEY", "configured-value"),
    ("codecov.signing_secret", "SENTRY_CODECOV_SIGNING_SECRET", "configured-value"),
    ("cursor-origin-app.private-key", "SENTRY_CURSOR_ORIGIN_APP_PRIVATE_KEY", "configured-value"),
    ("discord.bot-token", "SENTRY_DISCORD_BOT_TOKEN", "configured-value"),
    ("discord.client-secret", "SENTRY_DISCORD_CLIENT_SECRET", "configured-value"),
    ("gcp.client-secret", "SENTRY_GCP_CLIENT_SECRET", "configured-value"),
    ("github-app.client-secret", "SENTRY_GITHUB_APP_CLIENT_SECRET", "configured-value"),
    ("github-app.private-key", "SENTRY_GITHUB_APP_PRIVATE_KEY", "configured-value"),
    ("github-app.webhook-secret", "SENTRY_GITHUB_APP_WEBHOOK_SECRET", "configured-value"),
    ("mail.mailgun-api-key", "SENTRY_MAILGUN_API_KEY", "configured-value"),
    ("msteams.client-secret", "SENTRY_MSTEAMS_CLIENT_SECRET", "configured-value"),
    ("slack.client-secret", "SENTRY_SLACK_CLIENT_SECRET", "configured-value"),
    ("slack.signing-secret", "SENTRY_SLACK_SIGNING_SECRET", "configured-value"),
    ("slack-staging.client-secret", "SENTRY_SLACK_STAGING_CLIENT_SECRET", "configured-value"),
    ("slack-staging.signing-secret", "SENTRY_SLACK_STAGING_SIGNING_SECRET", "configured-value"),
    ("slack.verification-token", "SENTRY_SLACK_VERIFICATION_TOKEN", "configured-value"),
    ("sms.twilio-token", "SENTRY_SMS_TWILIO_TOKEN", "configured-value"),
    ("vercel.client-secret", "SENTRY_VERCEL_CLIENT_SECRET", "configured-value"),
    ("vsts.client-secret", "SENTRY_VSTS_CLIENT_SECRET", "configured-value"),
    ("vsts-limited.client-secret", "SENTRY_VSTS_LIMITED_CLIENT_SECRET", "configured-value"),
    ("vsts_new.client-secret", "SENTRY_VSTS_NEW_CLIENT_SECRET", "configured-value"),
    ("auth-fly.client-id", "SENTRY_AUTH_FLY_CLIENT_ID", "configured-value"),
    ("auth-google.client-id", "SENTRY_AUTH_GOOGLE_CLIENT_ID", "configured-value"),
    ("msteams.app-id", "SENTRY_MSTEAMS_APP_ID", "configured-value"),
    ("sms.backend", "SENTRY_SMS_BACKEND", "configured-value"),
    ("github-app.id", "SENTRY_GITHUB_APP_ID", 42),
    ("github-app.name", "SENTRY_GITHUB_APP_NAME", "configured-value"),
    ("github-app.client-id", "SENTRY_GITHUB_APP_CLIENT_ID", "configured-value"),
    ("github-console-sdk-app.id", "SENTRY_GITHUB_CONSOLE_SDK_APP_ID", 42),
    ("slack.client-id", "SENTRY_SLACK_CLIENT_ID", "configured-value"),
    ("slack-staging.client-id", "SENTRY_SLACK_STAGING_CLIENT_ID", "configured-value"),
    ("msteams.client-id", "SENTRY_MSTEAMS_CLIENT_ID", "configured-value"),
    ("msteams.tenant-id", "SENTRY_MSTEAMS_TENANT_ID", "configured-value"),
    ("vercel.client-id", "SENTRY_VERCEL_CLIENT_ID", "configured-value"),
    ("discord.application-id", "SENTRY_DISCORD_APPLICATION_ID", "configured-value"),
    ("discord.public-key", "SENTRY_DISCORD_PUBLIC_KEY", "configured-value"),
    ("gcp.client-id", "SENTRY_GCP_CLIENT_ID", "configured-value"),
    ("vsts.client-id", "SENTRY_VSTS_CLIENT_ID", "configured-value"),
    ("vsts-limited.client-id", "SENTRY_VSTS_LIMITED_CLIENT_ID", "configured-value"),
    ("vsts_new.client-id", "SENTRY_VSTS_NEW_CLIENT_ID", "configured-value"),
    ("aws-lambda.access-key-id", "SENTRY_AWS_LAMBDA_ACCESS_KEY_ID", "configured-value"),
    ("aws-lambda.account-number", "SENTRY_AWS_LAMBDA_ACCOUNT_NUMBER", "configured-value"),
    ("aws-lambda.cloudformation-url", "SENTRY_AWS_LAMBDA_CLOUDFORMATION_URL", "configured-value"),
    ("pagerduty.app-id", "SENTRY_PAGERDUTY_APP_ID", "configured-value"),
    ("cursor-origin-app.id", "SENTRY_CURSOR_ORIGIN_APP_ID", "configured-value"),
    ("system.internal-url-prefix", "SENTRY_SYSTEM_INTERNAL_URL_PREFIX", "configured-value"),
    ("symbolicator.enabled", "SENTRY_SYMBOLICATOR_ENABLED", True),
    ("symbolicator.options", "SENTRY_SYMBOLICATOR_OPTIONS", {"url": "http://configured.invalid"}),
    ("symbolserver.enabled", "SENTRY_SYMBOLSERVER_ENABLED", True),
    ("symbolserver.options", "SENTRY_SYMBOLSERVER_OPTIONS", {"url": "http://configured.invalid"}),
    ("replay.storage.backend", "SENTRY_REPLAY_STORAGE_BACKEND", "configured-value"),
    (
        "replay.storage.options",
        "SENTRY_REPLAY_STORAGE_OPTIONS",
        {"url": "http://configured.invalid"},
    ),
    ("chart-rendering.enabled", "SENTRY_CHART_RENDERING_ENABLED", True),
    (
        "chart-rendering.chartcuterie",
        "SENTRY_CHART_RENDERING_CHARTCUTERIE",
        {"url": "http://configured.invalid"},
    ),
    (
        "chart-rendering.storage.backend",
        "SENTRY_CHART_RENDERING_STORAGE_BACKEND",
        "configured-value",
    ),
    (
        "chart-rendering.storage.options",
        "SENTRY_CHART_RENDERING_STORAGE_OPTIONS",
        {"url": "http://configured.invalid"},
    ),
    ("dsym.cache-path", "SENTRY_DSYM_CACHE_PATH", "configured-value"),
    ("releasefile.cache-path", "SENTRY_RELEASEFILE_CACHE_PATH", "configured-value"),
    ("mail.enable-replies", "SENTRY_MAIL_ENABLE_REPLIES", True),
    ("mail.reply-hostname", "SENTRY_MAIL_REPLY_HOSTNAME", "configured-value"),
    ("system.support-email", "SENTRY_SYSTEM_SUPPORT_EMAIL", "configured-value"),
    ("system.security-email", "SENTRY_SYSTEM_SECURITY_EMAIL", "configured-value"),
    ("u2f.facets", "SENTRY_U2F_FACETS", ["configured-value"]),
    ("sms.twilio-account", "SENTRY_SMS_TWILIO_ACCOUNT", "configured-value"),
    ("sms.twilio-number", "SENTRY_SMS_TWILIO_NUMBER", "configured-value"),
]


@pytest.mark.parametrize("self_hosted", [False, True])
@pytest.mark.parametrize(
    "key, setting_name, value",
    DEPLOYMENT_OPTION_CASES,
)
def test_deployment_options_promote_explicit_values(
    settings, config_yml, self_hosted, key, setting_name, value
) -> None:
    from yaml import safe_dump

    settings.SENTRY_SELF_HOSTED = self_hosted
    settings.SENTRY_OPTIONS = {key: value}
    bootstrap_options(settings)
    assert getattr(settings, setting_name) == value

    settings.SENTRY_OPTIONS = {}
    config_yml.write(safe_dump({key: value}))
    bootstrap_options(settings, str(config_yml))
    assert getattr(settings, setting_name) == value


@pytest.mark.parametrize("self_hosted", [False, True])
@pytest.mark.parametrize("key, setting_name, value", DEPLOYMENT_OPTION_CASES)
def test_deployment_options_ignore_defaults_and_null(
    settings, self_hosted, key, setting_name, value
) -> None:
    settings.SENTRY_SELF_HOSTED = self_hosted
    setattr(settings, setting_name, value)
    settings.SENTRY_DEFAULT_OPTIONS = {key: "registered-default"}
    settings.SENTRY_OPTIONS = {key: None}

    bootstrap_options(settings)

    assert getattr(settings, setting_name) == value


def test_single_organization_reuses_github_app_client_id(settings) -> None:
    settings.SENTRY_SINGLE_ORGANIZATION = True
    settings.SENTRY_GITHUB_APP_CLIENT_SECRET = ""
    settings.SENTRY_GITHUB_APP_CLIENT_ID = "app-client-id"
    settings.SENTRY_OPTIONS = {"github-login.client-id": "login-client-id"}

    bootstrap_options(settings)

    assert settings.GITHUB_APP_ID == "app-client-id"


def test_single_organization_keeps_option_github_client_id_remap(settings) -> None:
    settings.SENTRY_SINGLE_ORGANIZATION = True
    settings.SENTRY_GITHUB_APP_CLIENT_SECRET = ""
    settings.SENTRY_OPTIONS = {
        "github-app.client-id": "app-client-id",
        "github-login.client-id": "login-client-id",
    }

    with patch.dict(
        "sentry.runner.initializer.options_mapper",
        {"github-app.client-id": "GITHUB_APP_ID", "github-app.client-secret": "GITHUB_API_SECRET"},
    ):
        bootstrap_options(settings)

    assert settings.GITHUB_APP_ID == "login-client-id"
    assert settings.SENTRY_GITHUB_APP_CLIENT_ID == "app-client-id"


@pytest.mark.parametrize("key, setting_name, login_setting", [
    ("github-app.client-id", "SENTRY_GITHUB_APP_CLIENT_ID", "GITHUB_APP_ID"),
    ("github-app.client-secret", "SENTRY_GITHUB_APP_CLIENT_SECRET", "GITHUB_API_SECRET"),
])
def test_single_organization_direct_app_setting_survives_login_reverse_mapping(
    settings, key, setting_name, login_setting
) -> None:
    settings.SENTRY_SINGLE_ORGANIZATION = True
    settings.SENTRY_GITHUB_APP_CLIENT_SECRET = "app-secret"
    settings.SENTRY_GITHUB_APP_CLIENT_ID = "app-client-id"
    setattr(settings, login_setting, "login-value")
    setattr(settings, setting_name, "app-value")

    with (
        pytest.warns(DeprecatedSettingWarning),
        patch.dict(
            "sentry.runner.initializer.options_mapper",
            {"github-app.client-id": "GITHUB_APP_ID", "github-app.client-secret": "GITHUB_API_SECRET"},
        ),
    ):
        bootstrap_options(settings)

    assert getattr(settings, setting_name) == "app-value"
    assert getattr(settings, login_setting) == "app-value"
    assert key not in settings.SENTRY_OPTIONS


@pytest.mark.parametrize("modern_value, option_value, expected_app", [
    ("app-value", "configured-value", "configured-value"),
    ("app-value", "", ""),
    ("app-value", None, "app-value"),
    ("", "configured-value", "configured-value"),
    ("", "", ""),
    ("", None, ""),
])
@pytest.mark.parametrize("key, setting_name, login_setting", [
    ("github-app.client-id", "SENTRY_GITHUB_APP_CLIENT_ID", "GITHUB_APP_ID"),
    ("github-app.client-secret", "SENTRY_GITHUB_APP_CLIENT_SECRET", "GITHUB_API_SECRET"),
])
def test_single_organization_config_app_key_retains_remap_precedence(
    settings, config_yml, modern_value, option_value, expected_app,
    key, setting_name, login_setting
) -> None:
    from yaml import safe_dump

    settings.SENTRY_SINGLE_ORGANIZATION = True
    settings.SENTRY_GITHUB_APP_CLIENT_SECRET = ""
    setattr(settings, setting_name, modern_value)
    setattr(settings, login_setting, "login-value")
    config_yml.write(safe_dump({key: option_value}))

    with (
        pytest.warns(DeprecatedSettingWarning),
        patch.dict(
            "sentry.runner.initializer.options_mapper",
            {"github-app.client-id": "GITHUB_APP_ID", "github-app.client-secret": "GITHUB_API_SECRET"},
        ),
    ):
        bootstrap_options(settings, str(config_yml))

    assert getattr(settings, setting_name) == expected_app
    assert getattr(settings, login_setting) == "login-value"


def test_single_organization_bootstrap_reuses_paired_direct_app_credentials(settings) -> None:
    settings.SENTRY_SINGLE_ORGANIZATION = True
    settings.SENTRY_GITHUB_APP_CLIENT_ID = "app-client-id"
    settings.SENTRY_GITHUB_APP_CLIENT_SECRET = "app-client-secret"
    settings.SENTRY_OPTIONS = {
        "github-login.client-id": "login-client-id",
        "github-login.client-secret": "login-client-secret",
    }

    bootstrap_options(settings)

    assert (settings.GITHUB_APP_ID, settings.GITHUB_API_SECRET) == (
        "app-client-id", "app-client-secret"
    )
