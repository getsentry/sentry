from __future__ import absolute_import

from .url import URLValidator


DEFAULT_VALIDATORS = {
    'url': [URLValidator],
}
