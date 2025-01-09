"""this module is lazily loaded -- it is ~/.sentry/sentry.conf.py overlayed on sentry.conf.server."""

from __future__ import annotations

import sys

from sentry.runner.importer import populate_module

populate_module(sys.modules[__name__])
