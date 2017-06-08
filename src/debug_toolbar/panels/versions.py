from __future__ import absolute_import, unicode_literals

import sys

import django
from django.conf import settings
from django.utils.translation import ugettext_lazy as _

from debug_toolbar.compat import import_module, OrderedDict
from debug_toolbar.panels import Panel


class VersionsPanel(Panel):
    """
    Shows versions of Python, Django, and installed apps if possible.
    """
    @property
    def nav_subtitle(self):
        return 'Django %s' % django.get_version()

    title = _("Versions")

    template = 'debug_toolbar/panels/versions.html'

    def process_response(self, request, response):
        versions = [
            ('Python', '%d.%d.%d' % sys.version_info[:3]),
            ('Django', self.get_app_version(django)),
        ]
        if django.VERSION[:2] >= (1, 7):
            versions += list(self.gen_app_versions_1_7())
        else:
            versions += list(self.gen_app_versions_1_6())
        self.record_stats({
            'versions': OrderedDict(sorted(versions, key=lambda v: v[0])),
            'paths': sys.path,
        })

    def gen_app_versions_1_7(self):
        from django.apps import apps
        for app_config in apps.get_app_configs():
            name = app_config.verbose_name
            app = app_config.module
            version = self.get_app_version(app)
            if version:
                yield name, version

    def gen_app_versions_1_6(self):
        for app in list(settings.INSTALLED_APPS):
            name = app.split('.')[-1].replace('_', ' ').capitalize()
            app = import_module(app)
            version = self.get_app_version(app)
            if version:
                yield name, version

    def get_app_version(self, app):
        if hasattr(app, 'get_version'):
            get_version = app.get_version
            if callable(get_version):
                version = get_version()
            else:
                version = get_version
        elif hasattr(app, 'VERSION'):
            version = app.VERSION
        elif hasattr(app, '__version__'):
            version = app.__version__
        else:
            return
        if isinstance(version, (list, tuple)):
            version = '.'.join(str(o) for o in version)
        return version
