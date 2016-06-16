"""
sentry.logging.renderers
~~~~~~~~~~~~~~~~~~~~~~~~
:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from msgpack import packb


class MessagePackRenderer(object):
    """
    Render the `event_dict` from structlog using msgpack.packb.

    If you are doing bad things and pass in a native object, it won't fail.
    """
    def __call__(self, logger, name, event_dict):
        for k, v in event_dict.items():
            # While this looks gross, json.dumps does it.
            if isinstance(v, basestring):
                event_dict[k] = event_dict[k].replace('\n', '\\n')
        return packb(event_dict, default=_encode_fallback)


def _encode_fallback(obj):
    if hasattr(obj, '__dict__'):
        return repr(obj)

    return obj
