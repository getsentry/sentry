from __future__ import absolute_import, unicode_literals

import warnings

from django.conf import settings
from django.utils import six

from debug_toolbar.compat import import_module


# Always import this module as follows:
# from debug_toolbar import settings [as dt_settings]

# Don't import directly CONFIG or PANELs, or you will miss changes performed
# with override_settings in tests.


CONFIG_DEFAULTS = {
    # Toolbar options
    'DISABLE_PANELS': set(['debug_toolbar.panels.redirects.RedirectsPanel']),
    'INSERT_BEFORE': '</body>',
    'JQUERY_URL': '//ajax.googleapis.com/ajax/libs/jquery/2.1.4/jquery.min.js',
    'RENDER_PANELS': None,
    'RESULTS_CACHE_SIZE': 10,
    'ROOT_TAG_EXTRA_ATTRS': '',
    'SHOW_COLLAPSED': False,
    'SHOW_TOOLBAR_CALLBACK': 'debug_toolbar.middleware.show_toolbar',
    # Panel options
    'EXTRA_SIGNALS': [],
    'ENABLE_STACKTRACES': True,
    'HIDE_IN_STACKTRACES': (
        'socketserver' if six.PY3 else 'SocketServer',
        'threading',
        'wsgiref',
        'debug_toolbar',
        'django',
    ),
    'PROFILER_MAX_DEPTH': 10,
    'SHOW_TEMPLATE_CONTEXT': True,
    'SQL_WARNING_THRESHOLD': 500,   # milliseconds
}

USER_CONFIG = getattr(settings, 'DEBUG_TOOLBAR_CONFIG', {})
# Backward-compatibility for 1.0, remove in 2.0.
_RENAMED_CONFIG = {
    'RESULTS_STORE_SIZE': 'RESULTS_CACHE_SIZE',
    'ROOT_TAG_ATTRS': 'ROOT_TAG_EXTRA_ATTRS',
    'HIDDEN_STACKTRACE_MODULES': 'HIDE_IN_STACKTRACES'
}
for old_name, new_name in _RENAMED_CONFIG.items():
    if old_name in USER_CONFIG:
        warnings.warn(
            "%r was renamed to %r. Update your DEBUG_TOOLBAR_CONFIG "
            "setting." % (old_name, new_name), DeprecationWarning)
        USER_CONFIG[new_name] = USER_CONFIG.pop(old_name)
if 'HIDE_DJANGO_SQL' in USER_CONFIG:
    warnings.warn(
        "HIDE_DJANGO_SQL was removed. Update your "
        "DEBUG_TOOLBAR_CONFIG setting.", DeprecationWarning)
    USER_CONFIG.pop('HIDE_DJANGO_SQL')
if 'TAG' in USER_CONFIG:
    warnings.warn(
        "TAG was replaced by INSERT_BEFORE. Update your "
        "DEBUG_TOOLBAR_CONFIG setting.", DeprecationWarning)
    USER_CONFIG['INSERT_BEFORE'] = '</%s>' % USER_CONFIG.pop('TAG')

CONFIG = CONFIG_DEFAULTS.copy()
CONFIG.update(USER_CONFIG)


PANELS_DEFAULTS = [
    'debug_toolbar.panels.versions.VersionsPanel',
    'debug_toolbar.panels.timer.TimerPanel',
    'debug_toolbar.panels.settings.SettingsPanel',
    'debug_toolbar.panels.headers.HeadersPanel',
    'debug_toolbar.panels.request.RequestPanel',
    'debug_toolbar.panels.sql.SQLPanel',
    'debug_toolbar.panels.staticfiles.StaticFilesPanel',
    'debug_toolbar.panels.templates.TemplatesPanel',
    'debug_toolbar.panels.cache.CachePanel',
    'debug_toolbar.panels.signals.SignalsPanel',
    'debug_toolbar.panels.logging.LoggingPanel',
    'debug_toolbar.panels.redirects.RedirectsPanel',
]

try:
    PANELS = list(settings.DEBUG_TOOLBAR_PANELS)
except AttributeError:
    PANELS = PANELS_DEFAULTS
else:
    # Backward-compatibility for 1.0, remove in 2.0.
    _RENAMED_PANELS = {
        'debug_toolbar.panels.version.VersionDebugPanel':
        'debug_toolbar.panels.versions.VersionsPanel',
        'debug_toolbar.panels.timer.TimerDebugPanel':
        'debug_toolbar.panels.timer.TimerPanel',
        'debug_toolbar.panels.settings_vars.SettingsDebugPanel':
        'debug_toolbar.panels.settings.SettingsPanel',
        'debug_toolbar.panels.headers.HeaderDebugPanel':
        'debug_toolbar.panels.headers.HeadersPanel',
        'debug_toolbar.panels.request_vars.RequestVarsDebugPanel':
        'debug_toolbar.panels.request.RequestPanel',
        'debug_toolbar.panels.sql.SQLDebugPanel':
        'debug_toolbar.panels.sql.SQLPanel',
        'debug_toolbar.panels.template.TemplateDebugPanel':
        'debug_toolbar.panels.templates.TemplatesPanel',
        'debug_toolbar.panels.cache.CacheDebugPanel':
        'debug_toolbar.panels.cache.CachePanel',
        'debug_toolbar.panels.signals.SignalDebugPanel':
        'debug_toolbar.panels.signals.SignalsPanel',
        'debug_toolbar.panels.logger.LoggingDebugPanel':
        'debug_toolbar.panels.logging.LoggingPanel',
        'debug_toolbar.panels.redirects.InterceptRedirectsDebugPanel':
        'debug_toolbar.panels.redirects.RedirectsPanel',
        'debug_toolbar.panels.profiling.ProfilingDebugPanel':
        'debug_toolbar.panels.profiling.ProfilingPanel',
    }
    for index, old_panel in enumerate(PANELS):
        new_panel = _RENAMED_PANELS.get(old_panel)
        if new_panel is not None:
            warnings.warn(
                "%r was renamed to %r. Update your DEBUG_TOOLBAR_PANELS "
                "setting." % (old_panel, new_panel), DeprecationWarning)
            PANELS[index] = new_panel


if 'INTERCEPT_REDIRECTS' in USER_CONFIG:
    warnings.warn(
        "INTERCEPT_REDIRECTS is deprecated. Please use the "
        "DISABLE_PANELS config in the "
        "DEBUG_TOOLBAR_CONFIG setting.", DeprecationWarning)
    if USER_CONFIG['INTERCEPT_REDIRECTS']:
        if 'debug_toolbar.panels.redirects.RedirectsPanel' \
                in CONFIG['DISABLE_PANELS']:
            # RedirectsPanel should be enabled
            try:
                CONFIG['DISABLE_PANELS'].remove(
                    'debug_toolbar.panels.redirects.RedirectsPanel'
                )
            except KeyError:
                # We wanted to remove it, but it didn't exist. This is fine
                pass
    elif 'debug_toolbar.panels.redirects.RedirectsPanel' \
            not in CONFIG['DISABLE_PANELS']:
        # RedirectsPanel should be disabled
        CONFIG['DISABLE_PANELS'].add(
            'debug_toolbar.panels.redirects.RedirectsPanel'
        )

PATCH_SETTINGS = getattr(settings, 'DEBUG_TOOLBAR_PATCH_SETTINGS', settings.DEBUG)


# The following functions can monkey-patch settings automatically. Several
# imports are placed inside functions to make it safe to import this module.


def check_middleware():
    from django.middleware.gzip import GZipMiddleware
    from debug_toolbar.middleware import DebugToolbarMiddleware
    gzip_index = None
    debug_toolbar_index = None

    # Determine the indexes which gzip and/or the toolbar are installed at
    for i, middleware in enumerate(settings.MIDDLEWARE_CLASSES):
        if is_middleware_class(GZipMiddleware, middleware):
            gzip_index = i
        elif is_middleware_class(DebugToolbarMiddleware, middleware):
            debug_toolbar_index = i
    # If the toolbar appears before the gzip index, raise a warning
    if gzip_index is not None and debug_toolbar_index < gzip_index:
        warnings.warn(
            "Please use an explicit setup with the "
            "debug_toolbar.middleware.DebugToolbarMiddleware "
            "after django.middleware.gzip.GZipMiddlware "
            "in MIDDLEWARE_CLASSES.", Warning)


def is_middleware_class(middleware_class, middleware_path):
    # This could be replaced by import_by_path in Django >= 1.6.
    try:
        mod_path, cls_name = middleware_path.rsplit('.', 1)
        mod = import_module(mod_path)
        middleware_cls = getattr(mod, cls_name)
    except (AttributeError, ImportError, ValueError):
        return
    return issubclass(middleware_cls, middleware_class)


def is_toolbar_middleware_installed():
    from debug_toolbar.middleware import DebugToolbarMiddleware
    return any(is_middleware_class(DebugToolbarMiddleware, middleware)
               for middleware in settings.MIDDLEWARE_CLASSES)


def prepend_to_setting(setting_name, value):
    """Insert value at the beginning of a list or tuple setting."""
    values = getattr(settings, setting_name)
    # Make a list [value] or tuple (value,)
    value = type(values)((value,))
    setattr(settings, setting_name, value + values)


def patch_internal_ips():
    if not settings.INTERNAL_IPS:
        prepend_to_setting('INTERNAL_IPS', '127.0.0.1')
        prepend_to_setting('INTERNAL_IPS', '::1')


def patch_middleware_classes():
    if not is_toolbar_middleware_installed():
        prepend_to_setting('MIDDLEWARE_CLASSES',
                           'debug_toolbar.middleware.DebugToolbarMiddleware')


def patch_root_urlconf():
    from django.conf.urls import include, url
    from django.core.urlresolvers import clear_url_caches, reverse, NoReverseMatch
    import debug_toolbar
    try:
        reverse('djdt:render_panel')
    except NoReverseMatch:
        urlconf_module = import_module(settings.ROOT_URLCONF)
        urlconf_module.urlpatterns = [
            url(r'^__debug__/', include(debug_toolbar.urls)),
        ] + urlconf_module.urlpatterns
        clear_url_caches()


def patch_all():
    patch_internal_ips()
    patch_middleware_classes()
    patch_root_urlconf()
