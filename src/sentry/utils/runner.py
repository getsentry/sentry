#!/usr/bin/env python
from __future__ import absolute_import, print_function

import warnings

# Backwards compatibility
from sentry.runner import configure, main  # NOQA

warnings.warn("'sentry.utils.runner' has moved to 'sentry.runner'", DeprecationWarning)
