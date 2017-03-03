"""
sentry.utils
~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import


# Make sure to not import anything here.  We want modules below
# sentry.utils to be able to import without having to pull in django
# or other sources that might not exist.
