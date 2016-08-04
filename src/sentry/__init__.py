"""
sentry
~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import os
import os.path

try:
    VERSION = __import__('pkg_resources') \
        .get_distribution('sentry').version
except Exception as e:
    VERSION = 'unknown'


def _get_git_revision(path):
    # First check for a HEAD, then fall back to refs/heads/master
    for f in os.path.join(path, 'HEAD'), os.path.join(path, 'refs', 'heads', 'master'):
        if os.path.exists(f):
            fh = open(f, 'r')
            try:
                return fh.read().strip()
            finally:
                fh.close()


def get_revision():
    """
    :returns: Revision number of this branch/checkout, if available. None if
        no revision number can be determined.
    """
    if 'SENTRY_BUILD' in os.environ:
        return os.environ['SENTRY_BUILD']
    package_dir = os.path.dirname(__file__)
    checkout_dir = os.path.normpath(os.path.join(package_dir, os.pardir, os.pardir))
    path = os.path.join(checkout_dir, '.git')
    if os.path.exists(path):
        return _get_git_revision(path)
    return None


def get_version():
    if __build__:
        return '%s.%s' % (__version__, __build__)
    return __version__


def is_docker():
    # One of these environment variables are guaranteed to exist
    # from our official docker images.
    # SENTRY_VERSION is from a tagged release, and SENTRY_BUILD is from a
    # a git based image.
    return 'SENTRY_VERSION' in os.environ or 'SENTRY_BUILD' in os.environ

__version__ = VERSION
__build__ = get_revision()
__docformat__ = 'restructuredtext en'
