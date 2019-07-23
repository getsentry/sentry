#!/usr/bin/env python
from __future__ import absolute_import, print_function

# Backwards compatibility
from sentry.runner import configure, main  # NOQA

import warnings

warnings.warn("'sentry.utils.runner' has moved to 'sentry.runner'", DeprecationWarning)
