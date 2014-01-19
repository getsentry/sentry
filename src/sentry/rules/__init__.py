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
    from sentry.utils.imports import import_string

    registry = RuleRegistry()
    for rule in SENTRY_RULES:
        cls = import_string(rule)
        registry.add(cls)
    return registry


rules = init_registry()
