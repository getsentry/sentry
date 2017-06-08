"""
The main DebugToolbar class that loads and renders the Toolbar.
"""

from __future__ import absolute_import, unicode_literals

import uuid

import django
from django.conf import settings
from django.conf.urls import url
from django.core.exceptions import ImproperlyConfigured
from django.template import TemplateSyntaxError
from django.template.loader import render_to_string

from debug_toolbar import settings as dt_settings
from debug_toolbar.compat import import_module, OrderedDict


class DebugToolbar(object):

    def __init__(self, request):
        self.request = request
        self.config = dt_settings.CONFIG.copy()
        self._panels = OrderedDict()
        for panel_class in self.get_panel_classes():
            panel_instance = panel_class(self)
            self._panels[panel_instance.panel_id] = panel_instance
        self.stats = {}
        self.store_id = None

    # Manage panels

    @property
    def panels(self):
        """
        Get a list of all available panels.
        """
        return list(self._panels.values())

    @property
    def enabled_panels(self):
        """
        Get a list of panels enabled for the current request.
        """
        return [panel for panel in self._panels.values() if panel.enabled]

    def get_panel_by_id(self, panel_id):
        """
        Get the panel with the given id, which is the class name by default.
        """
        return self._panels[panel_id]

    # Handle rendering the toolbar in HTML

    def render_toolbar(self):
        """
        Renders the overall Toolbar with panels inside.
        """
        if not self.should_render_panels():
            self.store()
        try:
            context = {'toolbar': self}
            return render_to_string('debug_toolbar/base.html', context)
        except TemplateSyntaxError:
            if django.VERSION[:2] >= (1, 7):
                from django.apps import apps
                staticfiles_installed = apps.is_installed(
                    'django.contrib.staticfiles')
            else:
                staticfiles_installed = ('django.contrib.staticfiles'
                                         in settings.INSTALLED_APPS)
            if not staticfiles_installed:
                raise ImproperlyConfigured(
                    "The debug toolbar requires the staticfiles contrib app. "
                    "Add 'django.contrib.staticfiles' to INSTALLED_APPS and "
                    "define STATIC_URL in your settings.")
            else:
                raise

    # Handle storing toolbars in memory and fetching them later on

    _store = OrderedDict()

    def should_render_panels(self):
        render_panels = self.config['RENDER_PANELS']
        if render_panels is None:
            # Django 1.4 still supports mod_python :( Fall back to the safe
            # and inefficient default in that case. Revert when we drop 1.4.
            render_panels = self.request.META.get('wsgi.multiprocess', True)
        return render_panels

    def store(self):
        self.store_id = uuid.uuid4().hex
        cls = type(self)
        cls._store[self.store_id] = self
        for _ in range(len(cls._store) - self.config['RESULTS_CACHE_SIZE']):
            try:
                # collections.OrderedDict
                cls._store.popitem(last=False)
            except TypeError:
                # django.utils.datastructures.SortedDict
                del cls._store[cls._store.keyOrder[0]]

    @classmethod
    def fetch(cls, store_id):
        return cls._store.get(store_id)

    # Manually implement class-level caching of panel classes and url patterns
    # because it's more obvious than going through an abstraction.

    _panel_classes = None

    @classmethod
    def get_panel_classes(cls):
        if cls._panel_classes is None:
            # Load panels in a temporary variable for thread safety.
            panel_classes = []
            for panel_path in dt_settings.PANELS:
                # This logic could be replaced with import_by_path in Django 1.6.
                try:
                    panel_module, panel_classname = panel_path.rsplit('.', 1)
                except ValueError:
                    raise ImproperlyConfigured(
                        "%s isn't a debug panel module" % panel_path)
                try:
                    mod = import_module(panel_module)
                except ImportError as e:
                    raise ImproperlyConfigured(
                        'Error importing debug panel %s: "%s"' %
                        (panel_module, e))
                try:
                    panel_class = getattr(mod, panel_classname)
                except AttributeError:
                    raise ImproperlyConfigured(
                        'Toolbar Panel module "%s" does not define a "%s" class' %
                        (panel_module, panel_classname))
                panel_classes.append(panel_class)
            cls._panel_classes = panel_classes
        return cls._panel_classes

    _urlpatterns = None

    @classmethod
    def get_urls(cls):
        if cls._urlpatterns is None:
            from . import views
            # Load URLs in a temporary variable for thread safety.
            # Global URLs
            urlpatterns = [
                url(r'^render_panel/$', views.render_panel, name='render_panel'),
            ]
            # Per-panel URLs
            for panel_class in cls.get_panel_classes():
                urlpatterns += panel_class.get_urls()
            cls._urlpatterns = urlpatterns
        return cls._urlpatterns


urlpatterns = DebugToolbar.get_urls()
