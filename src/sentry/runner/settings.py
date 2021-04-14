import os

import click

DEFAULT_SETTINGS_MODULE = "sentry.conf.server"
DEFAULT_SETTINGS_CONF = "config.yml"
DEFAULT_SETTINGS_OVERRIDE = "sentry.conf.py"


def generate_secret_key():
    from django.utils.crypto import get_random_string

    chars = "abcdefghijklmnopqrstuvwxyz0123456789!@#%^&*(-_=+)"
    return get_random_string(50, chars)


def load_config_template(path, version="default"):
    from pkg_resources import resource_string

    return resource_string("sentry", f"data/config/{path}.{version}").decode("utf8")


def generate_settings(dev=False):
    """
    This command is run when ``default_path`` doesn't exist, or ``init`` is
    run and returns a string representing the default data to put into their
    settings file.
    """
    context = {
        "secret_key": generate_secret_key(),
        "debug_flag": dev,
        "mail.backend": "console" if dev else "smtp",
    }

    py = load_config_template(DEFAULT_SETTINGS_OVERRIDE, "default") % context
    yaml = load_config_template(DEFAULT_SETTINGS_CONF, "default") % context
    return py, yaml


def get_sentry_conf():
    """
    Fetch the SENTRY_CONF value, either from the click context
    if available, or SENTRY_CONF environment variable.
    """
    try:
        ctx = click.get_current_context()
        return ctx.obj["config"]
    except (RuntimeError, KeyError, TypeError):
        try:
            return os.environ["SENTRY_CONF"]
        except KeyError:
            return "~/.sentry"


def discover_configs():
    """
    Discover the locations of three configuration components:
     * Config directory (~/.sentry)
     * Optional python config file (~/.sentry/sentry.conf.py)
     * Optional yaml config (~/.sentry/config.yml)
    """
    try:
        config = os.environ["SENTRY_CONF"]
    except KeyError:
        config = "~/.sentry"

    config = os.path.expanduser(config)

    # This is the old, now deprecated code path where SENTRY_CONF is pointed directly
    # to a python file
    if config.endswith((".py", ".conf")) or os.path.isfile(config):
        return (os.path.dirname(config), config, None)

    return (
        config,
        os.path.join(config, DEFAULT_SETTINGS_OVERRIDE),
        os.path.join(config, DEFAULT_SETTINGS_CONF),
    )


def configure(ctx, py, yaml, skip_service_validation=False):
    """
    Given the two different config files, set up the environment.

    NOTE: Will only execute once, so it's safe to call multiple times.
    """
    global __installed
    if __installed:
        return

    import warnings

    # Make sure that our warnings are always displayed.
    warnings.filterwarnings("default", "", Warning, r"^sentry")

    # This should be kept in-sync with sentry.utils.pytest.sentry,
    # and pytest warningfilters in pyproject.toml.
    # See pyproject.toml for explanations.
    from django.utils.deprecation import RemovedInDjango20Warning, RemovedInDjango21Warning

    warnings.filterwarnings(action="ignore", category=RemovedInDjango20Warning)
    warnings.filterwarnings(action="ignore", category=RemovedInDjango21Warning)
    warnings.filterwarnings(action="ignore", category=DeprecationWarning)

    # Add in additional mimetypes that are useful for our static files
    # which aren't common in default system registries
    import mimetypes

    for type, ext in (
        ("application/json", "map"),
        ("application/font-woff", "woff"),
        ("application/font-woff2", "woff2"),
        ("application/vnd.ms-fontobject", "eot"),
        ("application/x-font-ttf", "ttf"),
        ("application/x-font-ttf", "ttc"),
        ("font/opentype", "otf"),
        ("image/svg+xml", "svg"),
    ):
        mimetypes.add_type(type, "." + ext)

    from .importer import install

    if yaml is None:
        # `yaml` will be None when SENTRY_CONF is pointed
        # directly to a file, in which case, this file must exist
        if not os.path.exists(py):
            if ctx:
                raise click.ClickException(
                    "Configuration file does not exist. Use 'sentry init' to initialize the file."
                )
            raise ValueError(
                "Configuration file does not exist at '%s'" % click.format_filename(py)
            )
    elif not os.path.exists(yaml) and not os.path.exists(py):
        if ctx:
            raise click.ClickException(
                "Configuration file does not exist. Use 'sentry init' to initialize the file."
            )
        raise ValueError("Configuration file does not exist at '%s'" % click.format_filename(yaml))

    # Add autoreload for config.yml file if needed
    if yaml is not None and os.path.exists(yaml):
        from sentry.utils.uwsgi import reload_on_change

        reload_on_change(yaml)

    os.environ["DJANGO_SETTINGS_MODULE"] = "sentry_config"

    install("sentry_config", py, DEFAULT_SETTINGS_MODULE)

    from django.conf import settings

    # HACK: we need to force access of django.conf.settings to
    # ensure we don't hit any import-driven recursive behavior
    hasattr(settings, "INSTALLED_APPS")

    from .initializer import initialize_app

    initialize_app(
        {"config_path": py, "settings": settings, "options": yaml},
        skip_service_validation=skip_service_validation,
    )

    __installed = True


__installed = False
