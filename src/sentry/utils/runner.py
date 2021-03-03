#!/usr/bin/env python

# Backwards compatibility
from sentry.runner import configure, main  # NOQA

import warnings

warnings.warn("'sentry.utils.runner' has moved to 'sentry.runner'", DeprecationWarning)
