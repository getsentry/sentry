from __future__ import absolute_import

try:
    from libsourcemap import from_json
except ImportError:
    from .native import from_json  # NOQA
