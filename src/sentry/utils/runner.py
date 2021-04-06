#!/usr/bin/env python

# Backwards compatibility
import warnings

from sentry.runner import configure, main  # NOQA

warnings.warn("'sentry.utils.runner' has moved to 'sentry.runner'", DeprecationWarning)
