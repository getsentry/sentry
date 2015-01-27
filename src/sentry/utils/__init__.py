"""
sentry.utils
~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.utils.encoding import force_unicode

import six


def to_unicode(value):
    try:
        value = six.text_type(force_unicode(value))
    except (UnicodeEncodeError, UnicodeDecodeError):
        value = '(Error decoding value)'
    except Exception:  # in some cases we get a different exception
        try:
            value = str(repr(type(value)))
        except Exception:
            value = '(Error decoding value)'
    return value


def is_float(var):
    try:
        float(var)
    except (TypeError, ValueError):
        return False
    return True
