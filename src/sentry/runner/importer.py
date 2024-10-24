import importlib.metadata
import os.path
import types
from typing import Any

DEFAULT_SETTINGS_MODULE = "sentry.conf.server"
SENTRY_CONF_PY = os.path.expanduser("~/.sentry/sentry.conf.py")


def populate_module(settings_mod: types.ModuleType) -> None:
    default_settings_mod = importlib.import_module(DEFAULT_SETTINGS_MODULE)

    # install the default settings for this app
    _add_settings(default_settings_mod, settings=settings_mod)

    # install the custom settings for this app
    _load_settings(SENTRY_CONF_PY, settings=settings_mod)

    install_plugin_apps("sentry.apps", settings_mod)


def _load_settings(filename: str, settings: types.ModuleType) -> None:
    conf = types.ModuleType("temp_config")
    conf.__file__ = filename

    try:
        with open(filename, mode="rb") as source_file:
            exec(source_file.read(), conf.__dict__)
    except (FileNotFoundError, IsADirectoryError):
        return

    _add_settings(conf, settings=settings)


def install_plugin_apps(entry_point: str, settings: Any) -> None:
    # entry_points={
    #    'sentry.apps': [
    #         'phabricator = sentry_phabricator'
    #     ],
    # },
    installed_apps = list(settings.INSTALLED_APPS)
    for dist in importlib.metadata.distributions():
        for ep in dist.entry_points:
            if ep.group == entry_point:
                assert ":" not in ep.value, ep.value
                if ep.value not in installed_apps:
                    installed_apps.append(ep.value)

    settings.INSTALLED_APPS = tuple(installed_apps)


def _add_settings(mod: types.ModuleType, settings: types.ModuleType) -> None:
    """
    Adds all settings that are part of ``mod`` to the global settings object.
    Special cases ``EXTRA_INSTALLED_APPS`` to append the specified applications to the
    list of ``INSTALLED_APPS``.
    """

    for setting in dir(mod):
        if not setting.isupper():
            continue

        setting_value = getattr(mod, setting)

        # Any setting that starts with EXTRA_ and matches a setting that is a list or tuple
        # will automatically append the values to the current setting.
        # It might make sense to make this less magical
        if setting[:6] == "EXTRA_":
            base_setting = setting[6:]
            if isinstance(getattr(settings, base_setting), (list, tuple)):
                curval = getattr(settings, base_setting)
                setattr(settings, base_setting, curval + type(curval)(setting_value))
                continue

        setattr(settings, setting, setting_value)
