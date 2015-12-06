"""
sentry.rules
~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from .base import *  # NOQA
from .registry import RuleRegistry  # NOQA


def init_registry():
    from sentry.constants import SENTRY_RULES
    from sentry.plugins import plugins
    from sentry.utils.imports import import_string
    from sentry.utils.safe import safe_execute

    registry = RuleRegistry()
    for rule in SENTRY_RULES:
        cls = import_string(rule)
        registry.add(cls)
    for plugin in plugins.all(version=2):
        for cls in (safe_execute(plugin.get_rules) or ()):
            registry.add(cls)

    return registry


rules = init_registry()
