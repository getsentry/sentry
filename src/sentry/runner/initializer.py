from __future__ import absolute_import, print_function

import click
import logging
import os
import six

from django.conf import settings

from sentry.utils import metrics, warnings
from sentry.utils.sdk import configure_sdk
from sentry.utils.warnings import DeprecatedSettingWarning
from sentry.utils.compat import map

logger = logging.getLogger("sentry.runner.initializer")


def register_plugins(settings, raise_on_plugin_load_failure=False):
    from pkg_resources import iter_entry_points
    from sentry.plugins.base import plugins

    # entry_points={
    #    'sentry.plugins': [
    #         'phabricator = sentry_phabricator.plugins:PhabricatorPlugin'
    #     ],
    # },
    for ep in iter_entry_points("sentry.plugins"):
        try:
            plugin = ep.load()
        except Exception:
            import traceback

            click.echo(
                "Failed to load plugin %r:\n%s" % (ep.name, traceback.format_exc()), err=True
            )
            if raise_on_plugin_load_failure:
                raise
        else:
            plugins.register(plugin)

    for plugin in plugins.all(version=None):
        init_plugin(plugin)

    from sentry import integrations
    from sentry.utils.imports import import_string

    for integration_path in settings.SENTRY_DEFAULT_INTEGRATIONS:
        try:
            integration_cls = import_string(integration_path)
        except Exception:
            import traceback

            click.echo(
                "Failed to load integration %r:\n%s" % (integration_path, traceback.format_exc()),
                err=True,
            )
        else:
            integrations.register(integration_cls)

    for integration in integrations.all():
        try:
            integration.setup()
        except AttributeError:
            pass


def init_plugin(plugin):
    from sentry.plugins.base import bindings

    plugin.setup(bindings)

    # Register contexts from plugins if necessary
    if hasattr(plugin, "get_custom_contexts"):
        from sentry.interfaces.contexts import contexttype

        for cls in plugin.get_custom_contexts() or ():
            contexttype(cls)

    if hasattr(plugin, "get_cron_schedule") and plugin.is_enabled():
        schedules = plugin.get_cron_schedule()
        if schedules:
            settings.CELERYBEAT_SCHEDULE.update(schedules)

    if hasattr(plugin, "get_worker_imports") and plugin.is_enabled():
        imports = plugin.get_worker_imports()
        if imports:
            settings.CELERY_IMPORTS += tuple(imports)

    if hasattr(plugin, "get_worker_queues") and plugin.is_enabled():
        from kombu import Queue

        for queue in plugin.get_worker_queues():
            try:
                name, routing_key = queue
            except ValueError:
                name = routing_key = queue
            q = Queue(name, routing_key=routing_key)
            q.durable = False
            settings.CELERY_QUEUES.append(q)


def initialize_receivers():
    # force signal registration
    import sentry.receivers  # NOQA


def get_asset_version(settings):
    path = os.path.join(settings.STATIC_ROOT, "version")
    try:
        with open(path) as fp:
            return fp.read().strip()
    except IOError:
        from time import time

        return int(time())


# Options which must get extracted into Django settings while
# bootstrapping. Everything else will get validated and used
# as a part of OptionsManager.
options_mapper = {
    # 'cache.backend': 'SENTRY_CACHE',
    # 'cache.options': 'SENTRY_CACHE_OPTIONS',
    # 'system.databases': 'DATABASES',
    # 'system.debug': 'DEBUG',
    "system.secret-key": "SECRET_KEY",
    "mail.backend": "EMAIL_BACKEND",
    "mail.host": "EMAIL_HOST",
    "mail.port": "EMAIL_PORT",
    "mail.username": "EMAIL_HOST_USER",
    "mail.password": "EMAIL_HOST_PASSWORD",
    "mail.use-tls": "EMAIL_USE_TLS",
    "mail.from": "SERVER_EMAIL",
    "mail.subject-prefix": "EMAIL_SUBJECT_PREFIX",
}


def bootstrap_options(settings, config=None):
    """
    Quickly bootstrap options that come in from a config file
    and convert options into Django settings that are
    required to even initialize the rest of the app.
    """
    # Make sure our options have gotten registered
    from sentry.options import load_defaults

    load_defaults()

    options = {}
    if config is not None:
        # Attempt to load our config yaml file
        from sentry.utils.yaml import safe_load
        from yaml.parser import ParserError
        from yaml.scanner import ScannerError

        try:
            with open(config, "rb") as fp:
                options = safe_load(fp)
        except IOError:
            # Gracefully fail if yaml file doesn't exist
            pass
        except (AttributeError, ParserError, ScannerError) as e:
            from .importer import ConfigurationError

            raise ConfigurationError("Malformed config.yml file: %s" % six.text_type(e))

        # Empty options file, so fail gracefully
        if options is None:
            options = {}
        # Options needs to be a dict
        elif not isinstance(options, dict):
            from .importer import ConfigurationError

            raise ConfigurationError("Malformed config.yml file")

    from sentry.conf.server import DEAD

    # First move options from settings into options
    for k, v in six.iteritems(options_mapper):
        if getattr(settings, v, DEAD) is not DEAD and k not in options:
            warnings.warn(DeprecatedSettingWarning(options_mapper[k], "SENTRY_OPTIONS['%s']" % k))
            options[k] = getattr(settings, v)

    # Stuff everything else into SENTRY_OPTIONS
    # these will be validated later after bootstrapping
    for k, v in six.iteritems(options):
        settings.SENTRY_OPTIONS[k] = v

    # Now go back through all of SENTRY_OPTIONS and promote
    # back into settings. This catches the case when values are defined
    # only in SENTRY_OPTIONS and no config.yml file
    for o in (settings.SENTRY_DEFAULT_OPTIONS, settings.SENTRY_OPTIONS):
        for k, v in six.iteritems(o):
            if k in options_mapper:
                # Map the mail.backend aliases to something Django understands
                if k == "mail.backend":
                    try:
                        v = settings.SENTRY_EMAIL_BACKEND_ALIASES[v]
                    except KeyError:
                        pass
                # Escalate the few needed to actually get the app bootstrapped into settings
                setattr(settings, options_mapper[k], v)


def configure_structlog():
    """
    Make structlog comply with all of our options.
    """
    from django.conf import settings
    import logging.config
    import structlog
    from sentry import options
    from sentry.logging import LoggingFormat

    WrappedDictClass = structlog.threadlocal.wrap_dict(dict)
    kwargs = {
        "context_class": WrappedDictClass,
        "wrapper_class": structlog.stdlib.BoundLogger,
        "cache_logger_on_first_use": True,
        "processors": [
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.format_exc_info,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.UnicodeDecoder(),
        ],
    }

    fmt_from_env = os.environ.get("SENTRY_LOG_FORMAT")
    if fmt_from_env:
        settings.SENTRY_OPTIONS["system.logging-format"] = fmt_from_env.lower()

    fmt = options.get("system.logging-format")

    if fmt == LoggingFormat.HUMAN:
        from sentry.logging.handlers import HumanRenderer

        kwargs["processors"].extend(
            [structlog.processors.ExceptionPrettyPrinter(), HumanRenderer()]
        )
    elif fmt == LoggingFormat.MACHINE:
        from sentry.logging.handlers import JSONRenderer

        kwargs["processors"].append(JSONRenderer())

    structlog.configure(**kwargs)

    lvl = os.environ.get("SENTRY_LOG_LEVEL")

    if lvl and lvl not in logging._levelNames:
        raise AttributeError("%s is not a valid logging level." % lvl)

    settings.LOGGING["root"].update({"level": lvl or settings.LOGGING["default_level"]})

    if lvl:
        for logger in settings.LOGGING["overridable"]:
            try:
                settings.LOGGING["loggers"][logger].update({"level": lvl})
            except KeyError:
                raise KeyError("%s is not a defined logger." % logger)

    logging.config.dictConfig(settings.LOGGING)


def initialize_app(config, skip_service_validation=False):
    settings = config["settings"]

    bootstrap_options(settings, config["options"])

    configure_structlog()

    # Commonly setups don't correctly configure themselves for production envs
    # so lets try to provide a bit more guidance
    if settings.CELERY_ALWAYS_EAGER and not settings.DEBUG:
        warnings.warn(
            "Sentry is configured to run asynchronous tasks in-process. "
            "This is not recommended within production environments. "
            "See https://docs.sentry.io/on-premise/server/queue/ for more information."
        )

    if settings.SENTRY_SINGLE_ORGANIZATION:
        settings.SENTRY_FEATURES["organizations:create"] = False

    if not hasattr(settings, "SUDO_COOKIE_SECURE"):
        settings.SUDO_COOKIE_SECURE = getattr(settings, "SESSION_COOKIE_SECURE", False)
    if not hasattr(settings, "SUDO_COOKIE_DOMAIN"):
        settings.SUDO_COOKIE_DOMAIN = getattr(settings, "SESSION_COOKIE_DOMAIN", None)
    if not hasattr(settings, "SUDO_COOKIE_PATH"):
        settings.SUDO_COOKIE_PATH = getattr(settings, "SESSION_COOKIE_PATH", "/")

    if not hasattr(settings, "CSRF_COOKIE_SECURE"):
        settings.CSRF_COOKIE_SECURE = getattr(settings, "SESSION_COOKIE_SECURE", False)
    if not hasattr(settings, "CSRF_COOKIE_DOMAIN"):
        settings.CSRF_COOKIE_DOMAIN = getattr(settings, "SESSION_COOKIE_DOMAIN", None)
    if not hasattr(settings, "CSRF_COOKIE_PATH"):
        settings.CSRF_COOKIE_PATH = getattr(settings, "SESSION_COOKIE_PATH", "/")

    settings.CACHES["default"]["VERSION"] = settings.CACHE_VERSION

    settings.ASSET_VERSION = get_asset_version(settings)
    settings.STATIC_URL = settings.STATIC_URL.format(version=settings.ASSET_VERSION)

    if getattr(settings, "SENTRY_DEBUGGER", None) is None:
        settings.SENTRY_DEBUGGER = settings.DEBUG

    monkeypatch_model_unpickle()

    import django

    django.setup()

    monkeypatch_django_migrations()

    apply_legacy_settings(settings)

    bind_cache_to_option_store()

    register_plugins(settings)

    initialize_receivers()

    validate_options(settings)

    validate_snuba()

    configure_sdk()

    setup_services(validate=not skip_service_validation)

    from django.utils import timezone
    from sentry.app import env
    from sentry.runner.settings import get_sentry_conf

    env.data["config"] = get_sentry_conf()
    env.data["start_date"] = timezone.now()


def setup_services(validate=True):
    from sentry import (
        analytics,
        buffer,
        digests,
        newsletter,
        nodestore,
        quotas,
        ratelimits,
        search,
        tagstore,
        tsdb,
    )
    from .importer import ConfigurationError
    from sentry.utils.settings import reraise_as

    service_list = (
        analytics,
        buffer,
        digests,
        newsletter,
        nodestore,
        quotas,
        ratelimits,
        search,
        tagstore,
        tsdb,
    )

    for service in service_list:
        if validate:
            try:
                service.validate()
            except AttributeError as exc:
                reraise_as(
                    ConfigurationError(
                        u"{} service failed to call validate()\n{}".format(
                            service.__name__, six.text_type(exc)
                        )
                    )
                )
        try:
            service.setup()
        except AttributeError as exc:
            if not hasattr(service, "setup") or not callable(service.setup):
                reraise_as(
                    ConfigurationError(
                        u"{} service failed to call setup()\n{}".format(
                            service.__name__, six.text_type(exc)
                        )
                    )
                )
            raise


def validate_options(settings):
    from sentry.options import default_manager

    default_manager.validate(settings.SENTRY_OPTIONS, warn=True)


import django.db.models.base

model_unpickle = django.db.models.base.model_unpickle


def __model_unpickle_compat(model_id, attrs=None, factory=None):
    if attrs is not None or factory is not None:
        metrics.incr("django.pickle.loaded_19_pickle.__model_unpickle_compat", sample_rate=1)
        logger.error(
            "django.compat.model-unpickle-compat",
            extra={"model_id": model_id, "attrs": attrs, "factory": factory},
            exc_info=True,
        )
    return model_unpickle(model_id)


def __simple_class_factory_compat(model, attrs):
    return model


def monkeypatch_model_unpickle():
    # https://code.djangoproject.com/ticket/27187
    # Django 1.10 breaks pickle compat with 1.9 models.
    django.db.models.base.model_unpickle = __model_unpickle_compat

    # Django 1.10 needs this to unpickle 1.9 models, but we can't branch while
    # monkeypatching else our monkeypatched funcs won't be pickleable.
    # So just vendor simple_class_factory from 1.9.
    django.db.models.base.simple_class_factory = __simple_class_factory_compat


def monkeypatch_django_migrations():
    # This monkeypatches django's migration executor with our own, which
    # adds some small but important customizations.
    import sentry.new_migrations.monkey  # NOQA


def bind_cache_to_option_store():
    # The default ``OptionsStore`` instance is initialized without the cache
    # backend attached. The store itself utilizes the cache during normal
    # operation, but can't use the cache before the options (which typically
    # includes the cache configuration) have been bootstrapped from the legacy
    # settings and/or configuration values. Those options should have been
    # loaded at this point, so we can plug in the cache backend before
    # continuing to initialize the remainder of the application.
    from django.core.cache import cache as default_cache
    from sentry.options import default_store

    default_store.cache = default_cache


def show_big_error(message):
    if isinstance(message, six.string_types):
        lines = message.strip().splitlines()
    else:
        lines = message
    maxline = max(map(len, lines))
    click.echo("", err=True)
    click.secho("!!!%s!!!" % ("!" * min(maxline, 80),), err=True, fg="red")
    click.secho("!! %s !!" % "".center(maxline), err=True, fg="red")
    for line in lines:
        click.secho("!! %s !!" % line.center(maxline), err=True, fg="red")
    click.secho("!! %s !!" % "".center(maxline), err=True, fg="red")
    click.secho("!!!%s!!!" % ("!" * min(maxline, 80),), err=True, fg="red")
    click.echo("", err=True)


def apply_legacy_settings(settings):
    from sentry import options

    # SENTRY_USE_QUEUE used to determine if Celery was eager or not
    if hasattr(settings, "SENTRY_USE_QUEUE"):
        warnings.warn(
            DeprecatedSettingWarning(
                "SENTRY_USE_QUEUE",
                "CELERY_ALWAYS_EAGER",
                "https://docs.sentry.io/on-premise/server/queue/",
            )
        )
        settings.CELERY_ALWAYS_EAGER = not settings.SENTRY_USE_QUEUE

    for old, new in (
        ("SENTRY_ADMIN_EMAIL", "system.admin-email"),
        ("SENTRY_URL_PREFIX", "system.url-prefix"),
        ("SENTRY_SYSTEM_MAX_EVENTS_PER_MINUTE", "system.rate-limit"),
        ("SENTRY_ENABLE_EMAIL_REPLIES", "mail.enable-replies"),
        ("SENTRY_SMTP_HOSTNAME", "mail.reply-hostname"),
        ("MAILGUN_API_KEY", "mail.mailgun-api-key"),
        ("SENTRY_FILESTORE", "filestore.backend"),
        ("SENTRY_FILESTORE_OPTIONS", "filestore.options"),
        ("GOOGLE_CLIENT_ID", "auth-google.client-id"),
        ("GOOGLE_CLIENT_SECRET", "auth-google.client-secret"),
    ):
        if new not in settings.SENTRY_OPTIONS and hasattr(settings, old):
            warnings.warn(DeprecatedSettingWarning(old, "SENTRY_OPTIONS['%s']" % new))
            settings.SENTRY_OPTIONS[new] = getattr(settings, old)

    if hasattr(settings, "SENTRY_REDIS_OPTIONS"):
        if "redis.clusters" in settings.SENTRY_OPTIONS:
            raise Exception(
                "Cannot specify both SENTRY_OPTIONS['redis.clusters'] option and SENTRY_REDIS_OPTIONS setting."
            )
        else:
            warnings.warn(
                DeprecatedSettingWarning(
                    "SENTRY_REDIS_OPTIONS",
                    'SENTRY_OPTIONS["redis.clusters"]',
                    removed_in_version="8.5",
                )
            )
            settings.SENTRY_OPTIONS["redis.clusters"] = {"default": settings.SENTRY_REDIS_OPTIONS}
    else:
        # Provide backwards compatibility to plugins expecting there to be a
        # ``SENTRY_REDIS_OPTIONS`` setting by using the ``default`` cluster.
        # This should be removed when ``SENTRY_REDIS_OPTIONS`` is officially
        # deprecated. (This also assumes ``FLAG_NOSTORE`` on the configuration
        # option.)
        settings.SENTRY_REDIS_OPTIONS = options.get("redis.clusters")["default"]

    if not hasattr(settings, "SENTRY_URL_PREFIX"):
        url_prefix = options.get("system.url-prefix", silent=True)
        if not url_prefix:
            # HACK: We need to have some value here for backwards compatibility
            url_prefix = "http://sentry.example.com"
        settings.SENTRY_URL_PREFIX = url_prefix

    if settings.TIME_ZONE != "UTC":
        # non-UTC timezones are not supported
        show_big_error("TIME_ZONE should be set to UTC")

    # Set ALLOWED_HOSTS if it's not already available
    if not settings.ALLOWED_HOSTS:
        settings.ALLOWED_HOSTS = ["*"]

    if hasattr(settings, "SENTRY_ALLOW_REGISTRATION"):
        warnings.warn(
            DeprecatedSettingWarning(
                "SENTRY_ALLOW_REGISTRATION", 'SENTRY_FEATURES["auth:register"]'
            )
        )
        settings.SENTRY_FEATURES["auth:register"] = settings.SENTRY_ALLOW_REGISTRATION

    settings.DEFAULT_FROM_EMAIL = settings.SENTRY_OPTIONS.get(
        "mail.from", settings.SENTRY_DEFAULT_OPTIONS.get("mail.from")
    )

    # HACK(mattrobenolt): This is a one-off assertion for a system.secret-key value.
    # If this becomes a pattern, we could add another flag to the OptionsManager to cover this, but for now
    # this is the only value that should prevent the app from booting up. Currently FLAG_REQUIRED is used to
    # trigger the Installation Wizard, not abort startup.
    if not settings.SENTRY_OPTIONS.get("system.secret-key"):
        from .importer import ConfigurationError

        raise ConfigurationError(
            "`system.secret-key` MUST be set. Use 'sentry config generate-secret-key' to get one."
        )


def validate_snuba():
    """
    Make sure everything related to Snuba is in sync.

    This covers a few cases:

    * When you have features related to Snuba, you must also
      have Snuba fully configured correctly to continue.
    * If you have Snuba specific search/tagstore/tsdb backends,
      you must also have a Snuba compatible eventstream backend
      otherwise no data will be written into Snuba.
    * If you only have Snuba related eventstream, yell that you
      probably want the other backends otherwise things are weird.
    """
    if not settings.DEBUG:
        return

    has_all_snuba_required_backends = (
        settings.SENTRY_SEARCH == "sentry.search.snuba.EventsDatasetSnubaSearchBackend"
        and settings.SENTRY_TAGSTORE == "sentry.tagstore.snuba.SnubaTagStorage"
        and
        # TODO(mattrobenolt): Remove ServiceDelegator check
        settings.SENTRY_TSDB
        in ("sentry.tsdb.redissnuba.RedisSnubaTSDB", "sentry.utils.services.ServiceDelegator")
    )

    eventstream_is_snuba = (
        settings.SENTRY_EVENTSTREAM == "sentry.eventstream.snuba.SnubaEventStream"
        or settings.SENTRY_EVENTSTREAM == "sentry.eventstream.kafka.KafkaEventStream"
    )

    # All good here, it doesn't matter what else is going on
    if has_all_snuba_required_backends and eventstream_is_snuba:
        return

    from sentry.features import requires_snuba as snuba_features

    snuba_enabled_features = set()

    for feature in snuba_features:
        if settings.SENTRY_FEATURES.get(feature, False):
            snuba_enabled_features.add(feature)

    if snuba_enabled_features and not eventstream_is_snuba:
        from .importer import ConfigurationError

        show_big_error(
            """
You have features enabled which require Snuba,
but you don't have any Snuba compatible configuration.

Features you have enabled:
%s

See: https://github.com/getsentry/snuba#sentry--snuba
"""
            % "\n".join(snuba_enabled_features)
        )
        raise ConfigurationError("Cannot continue without Snuba configured.")

    if not eventstream_is_snuba:
        from .importer import ConfigurationError

        show_big_error(
            """
It appears that you are requiring Snuba,
but your SENTRY_EVENTSTREAM is not compatible.

Current settings:

SENTRY_SEARCH = %r
SENTRY_TAGSTORE = %r
SENTRY_TSDB = %r
SENTRY_EVENTSTREAM = %r

See: https://github.com/getsentry/snuba#sentry--snuba"""
            % (
                settings.SENTRY_SEARCH,
                settings.SENTRY_TAGSTORE,
                settings.SENTRY_TSDB,
                settings.SENTRY_EVENTSTREAM,
            )
        )
        raise ConfigurationError("Cannot continue without Snuba configured correctly.")

    if eventstream_is_snuba and not has_all_snuba_required_backends:
        show_big_error(
            """
You are using a Snuba compatible eventstream
without configuring search/tagstore/tsdb also to use Snuba.
This is probably not what you want.

Current settings:

SENTRY_SEARCH = %r
SENTRY_TAGSTORE = %r
SENTRY_TSDB = %r
SENTRY_EVENTSTREAM = %r

See: https://github.com/getsentry/snuba#sentry--snuba"""
            % (
                settings.SENTRY_SEARCH,
                settings.SENTRY_TAGSTORE,
                settings.SENTRY_TSDB,
                settings.SENTRY_EVENTSTREAM,
            )
        )
