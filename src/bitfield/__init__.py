"""
django-bitfield
~~~~~~~~~~~~~~~
"""
from __future__ import absolute_import

from bitfield.models import Bit, BitHandler, CompositeBitField, BitField  # NOQA

default_app_config = 'bitfield.apps.BitFieldAppConfig'

try:
    VERSION = __import__('pkg_resources') \
        .get_distribution('bitfield').version
except Exception:
    VERSION = 'unknown'
