from __future__ import absolute_import

import six
from sentry.utils.compat import map

version = (0, 7, 28)

__version__ = ".".join(map(six.text_type, version))
