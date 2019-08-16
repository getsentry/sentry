from __future__ import absolute_import

import pytest
import six

from sentry.runner.importer import ConfigurationError
from sentry.runner.initializer import bootstrap_options, apply_legacy_settings


@pytest.fixture
def settings():
    class Settings(object):
        pass

    s = Settings()
    s.TIME_ZONE = "UTC"
    s.ALLOWED_HOSTS = []
    s.SENTRY_FEATURES = {}
    s.SENTRY_OPTIONS = {}
    s.SENTRY_DEFAULT_OPTIONS = {}
    s.SENTRY_EMAIL_BACKEND_ALIASES = {"dummy": "alias-for-dummy"}
    return s


@pytest.fixture
def config_yml(tmpdir):
    return tmpdir.join("config.yml")


def test_bootstrap_options_simple(settings, config_yml):
    "Config options are specified in both places, but config.yml should prevail"
    settings.SECRET_KEY = "xxx"
    settings.EMAIL_BACKEND = "xxx"
    settings.EMAIL_HOST = "xxx"
    settings.EMAIL_PORT = 6969
    settings.EMAIL_HOST_USER = "xxx"
    settings.EMAIL_HOST_PASSWORD = "xxx"
    settings.EMAIL_USE_TLS = False
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
mail.from: my-mail-from
mail.subject-prefix: my-mail-subject-prefix
"""
    )

    bootstrap_options(settings, six.text_type(config_yml))
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
    assert settings.SERVER_EMAIL == "my-mail-from"
    assert settings.EMAIL_SUBJECT_PREFIX == "my-mail-subject-prefix"


def test_bootstrap_options_malformed_yml(settings, config_yml):
    config_yml.write("1")
    with pytest.raises(ConfigurationError):
        bootstrap_options(settings, six.text_type(config_yml))

    config_yml.write("{{{")
    with pytest.raises(ConfigurationError):
        bootstrap_options(settings, six.text_type(config_yml))


def test_bootstrap_options_no_config(settings):
    "No config file should gracefully extract values out of settings"
    settings.SECRET_KEY = "my-system-secret-key"
    settings.EMAIL_BACKEND = "my-mail-backend"
    settings.EMAIL_HOST = "my-mail-host"
    settings.EMAIL_PORT = 123
    settings.EMAIL_HOST_USER = "my-mail-username"
    settings.EMAIL_HOST_PASSWORD = "my-mail-password"
    settings.EMAIL_USE_TLS = True
    settings.SERVER_EMAIL = "my-mail-from"
    settings.EMAIL_SUBJECT_PREFIX = "my-mail-subject-prefix"
    settings.FOO_BAR = "lol"

    bootstrap_options(settings)
    assert settings.SENTRY_OPTIONS == {
        "system.secret-key": "my-system-secret-key",
        "mail.backend": "my-mail-backend",
        "mail.host": "my-mail-host",
        "mail.port": 123,
        "mail.username": "my-mail-username",
        "mail.password": "my-mail-password",
        "mail.use-tls": True,
        "mail.from": "my-mail-from",
        "mail.subject-prefix": "my-mail-subject-prefix",
    }


def test_bootstrap_options_no_config_only_sentry_options(settings):
    "SENTRY_OPTIONS is only declared, but should be promoted into settings"
    settings.SENTRY_OPTIONS = {
        "system.secret-key": "my-system-secret-key",
        "mail.backend": "my-mail-backend",
        "mail.host": "my-mail-host",
        "mail.port": 123,
        "mail.username": "my-mail-username",
        "mail.password": "my-mail-password",
        "mail.use-tls": True,
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
    assert settings.SERVER_EMAIL == "my-mail-from"
    assert settings.EMAIL_SUBJECT_PREFIX == "my-mail-subject-prefix"


def test_bootstrap_options_mail_aliases(settings):
    settings.SENTRY_OPTIONS = {"mail.backend": "dummy"}
    bootstrap_options(settings)
    assert settings.EMAIL_BACKEND == "alias-for-dummy"


def test_bootstrap_options_missing_file(settings):
    bootstrap_options(settings, "this-file-does-not-exist-xxxxxxxxxxxxxx.yml")
    assert settings.SENTRY_OPTIONS == {}


def test_bootstrap_options_empty_file(settings, config_yml):
    config_yml.write("")
    bootstrap_options(settings, six.text_type(config_yml))
    assert settings.SENTRY_OPTIONS == {}


def test_apply_legacy_settings(settings):
    settings.ALLOWED_HOSTS = []
    settings.SENTRY_USE_QUEUE = True
    settings.SENTRY_ALLOW_REGISTRATION = True
    settings.SENTRY_ADMIN_EMAIL = "admin-email"
    settings.SENTRY_URL_PREFIX = "http://url-prefix"
    settings.SENTRY_SYSTEM_MAX_EVENTS_PER_MINUTE = 10
    settings.SENTRY_REDIS_OPTIONS = {"foo": "bar"}
    settings.SENTRY_ENABLE_EMAIL_REPLIES = True
    settings.SENTRY_SMTP_HOSTNAME = "reply-hostname"
    settings.MAILGUN_API_KEY = "mailgun-api-key"
    settings.SENTRY_OPTIONS = {"system.secret-key": "secret-key", "mail.from": "mail-from"}
    settings.SENTRY_FILESTORE = "some-filestore"
    settings.SENTRY_FILESTORE_OPTIONS = {"filestore-foo": "filestore-bar"}
    apply_legacy_settings(settings)
    assert settings.CELERY_ALWAYS_EAGER is False
    assert settings.SENTRY_FEATURES["auth:register"] is True
    assert settings.SENTRY_OPTIONS == {
        "system.admin-email": "admin-email",
        "system.url-prefix": "http://url-prefix",
        "system.rate-limit": 10,
        "system.secret-key": "secret-key",
        "redis.clusters": {"default": {"foo": "bar"}},
        "mail.from": "mail-from",
        "mail.enable-replies": True,
        "mail.reply-hostname": "reply-hostname",
        "mail.mailgun-api-key": "mailgun-api-key",
        "filestore.backend": "some-filestore",
        "filestore.options": {"filestore-foo": "filestore-bar"},
    }
    assert settings.DEFAULT_FROM_EMAIL == "mail-from"
    assert settings.ALLOWED_HOSTS == ["*"]


def test_initialize_app(settings):
    "Just a sanity check of the full initialization process"
    settings.SENTRY_OPTIONS = {"system.secret-key": "secret-key"}
    bootstrap_options(settings)
    apply_legacy_settings(settings)


def test_require_secret_key(settings):
    assert "system.secret-key" not in settings.SENTRY_OPTIONS
    with pytest.raises(ConfigurationError):
        apply_legacy_settings(settings)
