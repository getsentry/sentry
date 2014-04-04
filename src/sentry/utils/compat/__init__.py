"""
sentry.utils.compat
~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

try:
    import cPickle as pickle
except ImportError:
    import pickle  # NOQA

try:
    from cStringIO import StringIO
except ImportError:
    from StringIO import StringIO  # NOQA
