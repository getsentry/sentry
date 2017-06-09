"""
This file exists to contain all Django and Python compatibility issues.

In order to avoid circular references, nothing should be imported from
debug_toolbar.
"""

import django
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

try:
    from django.core.cache import CacheHandler, caches
except ImportError:  # Django < 1.7
    CacheHandler = None
    caches = None

try:
    from django.template.engine import Engine
except ImportError:  # Django < 1.8
    Engine = None
    from django.template.context import get_standard_processors  # NOQA
    from django.template.loader import find_template_loader  # NOQA

try:
    from importlib import import_module
except ImportError:  # python = 2.6
    from django.utils.importlib import import_module  # NOQA

try:
    from collections import OrderedDict
except ImportError:  # python < 2.7
    from django.utils.datastructures import SortedDict as OrderedDict  # NOQA

try:
    from django.contrib.staticfiles.testing import (
        StaticLiveServerTestCase)
except ImportError:  # Django < 1.7
    from django.test import (  # NOQA
        LiveServerTestCase as StaticLiveServerTestCase)

try:
    from django.db.backends import utils as db_backends_util
except ImportError:  # Django >= 1.7
    from django.db.backends import util as db_backends_util  # NOQA

try:
    from django.dispatch.dispatcher import WEAKREF_TYPES
except ImportError:  # Django >= 1.7
    import weakref
    WEAKREF_TYPES = weakref.ReferenceType,


def get_template_dirs():
    """Compatibility method to fetch the template directories."""
    if Engine:
        try:
            engine = Engine.get_default()
        except ImproperlyConfigured:
            template_dirs = []
        else:
            template_dirs = engine.dirs
    else:  # Django < 1.8
        template_dirs = settings.TEMPLATE_DIRS
    return template_dirs


def get_template_loaders():
    """Compatibility method to fetch the template loaders."""
    if Engine:
        try:
            engine = Engine.get_default()
        except ImproperlyConfigured:
            loaders = []
        else:
            loaders = engine.template_loaders
    else:  # Django < 1.8
        loaders = [
            find_template_loader(loader_name)
            for loader_name in settings.TEMPLATE_LOADERS]
    return loaders


def get_template_context_processors():
    """Compatibility method to fetch the template context processors."""
    if Engine:
        try:
            engine = Engine.get_default()
        except ImproperlyConfigured:
            context_processors = []
        else:
            context_processors = engine.template_context_processors
    else:  # Django < 1.8
        context_processors = get_standard_processors()
    return context_processors

if django.VERSION[:2] < (1, 5):
    # If the user is using Django < 1.5, then load up the url tag
    # from future. Otherwise use the normal one. The purpose of this
    # is to get the url template tag that supports context variables
    # for the first argument, yet won't raise a deprecation warning
    # about importing it from future.
    from django.templatetags.future import url
else:
    from django.template.defaulttags import url  # NOQA

if django.VERSION[:2] < (1, 8):
    # If the user is using Django < 1.8, then import the unittest
    # library from Django so that it supports Python 2.6.
    # Django >= 1.8 no longer supports Python 2.6, so in those cases
    # simply load Python's unittest
    from django.utils import unittest
else:
    import unittest  # NOQA
