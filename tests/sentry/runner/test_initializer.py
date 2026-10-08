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
        SENTRY_CONFIGURED_OPTION_SETTINGS=frozenset(),
        SENTRY_GITHUB_APP_CLIENT_SECRET="",
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


@pytest.mark.parametrize("old_name, key, setting_name", [
    ("GOOGLE_CLIENT_SECRET", "auth-google.client-secret", "SENTRY_AUTH_GOOGLE_CLIENT_SECRET"),
    ("MAILGUN_API_KEY", "mail.mailgun-api-key", "SENTRY_MAILGUN_API_KEY"),
])
@pytest.mark.parametrize("value", ["", "deployment-secret"])
@pytest.mark.parametrize("self_hosted", [False, True])
def test_explicit_deployment_secret_is_not_replaced_by_legacy_alias(
    settings, old_name, key, setting_name, value, self_hosted
) -> None:
    settings.SENTRY_SELF_HOSTED = self_hosted
    settings.SENTRY_OPTIONS = {"system.secret-key": "test-system-secret"}
    settings.SENTRY_CONFIGURED_OPTION_SETTINGS = frozenset({setting_name})
    setattr(settings, old_name, "legacy-secret")
    setattr(settings, setting_name, value)

    bootstrap_options(settings)
    apply_legacy_settings(settings)

    assert getattr(settings, setting_name) == value
    assert key not in settings.SENTRY_OPTIONS


@pytest.mark.parametrize("old_name, key, setting_name", [
    ("GOOGLE_CLIENT_SECRET", "auth-google.client-secret", "SENTRY_AUTH_GOOGLE_CLIENT_SECRET"),
    ("MAILGUN_API_KEY", "mail.mailgun-api-key", "SENTRY_MAILGUN_API_KEY"),
])
def test_original_option_precedes_explicit_deployment_setting_and_alias(
    settings, old_name, key, setting_name
) -> None:
    settings.SENTRY_OPTIONS = {"system.secret-key": "test-system-secret", key: "option-secret"}
    settings.SENTRY_CONFIGURED_OPTION_SETTINGS = frozenset({setting_name})
    setattr(settings, old_name, "legacy-secret")
    setattr(settings, setting_name, "deployment-secret")

    bootstrap_options(settings)
    apply_legacy_settings(settings)

    assert getattr(settings, setting_name) == "option-secret"
    assert settings.SENTRY_OPTIONS[key] == "option-secret"


@pytest.mark.parametrize("old_name, key, setting_name", [
    ("GOOGLE_CLIENT_SECRET", "auth-google.client-secret", "SENTRY_AUTH_GOOGLE_CLIENT_SECRET"),
    ("MAILGUN_API_KEY", "mail.mailgun-api-key", "SENTRY_MAILGUN_API_KEY"),
])
def test_untracked_legacy_secret_alias_retains_precedence(settings, old_name, key, setting_name) -> None:
    settings.SENTRY_OPTIONS = {"system.secret-key": "test-system-secret"}
    setattr(settings, old_name, "legacy-secret")
    setattr(settings, setting_name, "deployment-secret")

    bootstrap_options(settings)
    with pytest.warns(DeprecatedSettingWarning):
        apply_legacy_settings(settings)

    assert getattr(settings, setting_name) == "legacy-secret"
    assert settings.SENTRY_OPTIONS[key] == "legacy-secret"


@pytest.mark.parametrize("configured_options, configured_settings", [
    ({"github-app.client-secret": "option-secret"}, frozenset()),
    ({}, frozenset({"SENTRY_GITHUB_APP_CLIENT_SECRET"})),
])
def test_single_org_preserves_original_or_explicit_empty_app_secret(
    settings, configured_options, configured_settings
) -> None:
    settings.SENTRY_SINGLE_ORGANIZATION = True
    settings.SENTRY_OPTIONS = configured_options
    settings.SENTRY_CONFIGURED_OPTION_SETTINGS = configured_settings
    settings.SENTRY_GITHUB_APP_CLIENT_SECRET = ""
    settings.GITHUB_API_SECRET = "login-secret"

    with (
        pytest.warns(DeprecatedSettingWarning),
        patch.dict(
            "sentry.runner.initializer.options_mapper",
            {"github-app.client-id": "GITHUB_APP_ID", "github-app.client-secret": "GITHUB_API_SECRET"},
        ),
    ):
        bootstrap_options(settings)

    assert settings.SENTRY_OPTIONS.get("github-app.client-secret", "") == settings.SENTRY_GITHUB_APP_CLIENT_SECRET
    assert settings.SENTRY_GITHUB_APP_CLIENT_SECRET != "login-secret"
