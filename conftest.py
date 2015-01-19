from __future__ import absolute_import

import sys
import os.path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

pytest_plugins = [
    'sentry.utils.pytest'
]
