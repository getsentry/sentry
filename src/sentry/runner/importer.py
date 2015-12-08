"""
sentry.runner.importer
~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2015 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import imp
import sys


def install(name, config_path, default_settings, callback=None):
    sys.meta_path.append(Importer(name, config_path, default_settings, callback))


class ConfigurationError(ValueError):
    pass


class Importer(object):
    def __init__(self, name, config_path, default_settings=None, callback=None):
        self.name = name
        self.config_path = config_path
        self.default_settings = default_settings
        self.callback = callback

    def __repr__(self):
        return "<%s for '%s' (%s)>" % (type(self), self.name, self.config_path)

    def find_module(self, fullname, path=None):
        if fullname != self.name:
            return
        return self

    def load_module(self, fullname):
        # Check to make sure it's not already in sys.modules in case of a reload()
        if fullname in sys.modules:
            return sys.modules[fullname]  # pragma: no cover

        try:
            mod = self._load_module(fullname)
        except Exception as e:
            from sentry.utils.settings import reraise_as
            msg = unicode(e)
            if msg:
                msg = '%s: %s' % (type(e).__name__, msg)
            else:
                msg = type(e).__name__
            reraise_as(ConfigurationError(msg))
        else:
            # Install into sys.modules explicitly
            sys.modules[fullname] = mod
            if self.callback is not None:
                self.callback(mod)
            return mod

    def _load_module(self, fullname):
        if self.default_settings:
            from django.utils.importlib import import_module
            default_settings_mod = import_module(self.default_settings)
        else:
            default_settings_mod = None

        settings_mod = imp.new_module(self.name)

        # Django doesn't play too nice without the config file living as a real file, so let's fake it.
        settings_mod.__file__ = self.config_path

        # install the default settings for this app
        load_settings(default_settings_mod, settings=settings_mod)

        # install the custom settings for this app
        load_settings(self.config_path, settings=settings_mod, silent=True)

        return settings_mod


def load_settings(mod_or_filename, settings, silent=False):
    if isinstance(mod_or_filename, basestring):
        conf = imp.new_module('temp_config')
        conf.__file__ = mod_or_filename
        try:
            execfile(mod_or_filename, conf.__dict__)
        except IOError as e:
            import errno
            if silent and e.errno in (errno.ENOENT, errno.EISDIR):
                return settings
            e.strerror = 'Unable to load configuration file (%s)' % e.strerror
            raise
    else:
        conf = mod_or_filename

    add_settings(conf, settings=settings)


def add_settings(mod, settings):
    """
    Adds all settings that are part of ``mod`` to the global settings object.
    Special cases ``EXTRA_APPS`` to append the specified applications to the
    list of ``INSTALLED_APPS``.
    """

    for setting in dir(mod):
        if not setting.isupper():
            continue

        setting_value = getattr(mod, setting)
        if setting in ('INSTALLED_APPS', 'TEMPLATE_DIRS') and isinstance(setting_value, basestring):
            setting_value = (setting_value,)  # In case the user forgot the comma.

        # Any setting that starts with EXTRA_ and matches a setting that is a list or tuple
        # will automatically append the values to the current setting.
        # It might make sense to make this less magical
        if setting[:6] == 'EXTRA_':
            base_setting = setting[6:]
            if isinstance(getattr(settings, base_setting), (list, tuple)):
                curval = getattr(settings, base_setting)
                setattr(settings, base_setting, curval + type(curval)(setting_value))
                continue

        setattr(settings, setting, setting_value)
