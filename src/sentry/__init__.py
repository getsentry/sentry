"""
sentry
~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import os
import os.path

from subprocess import check_output

try:
    VERSION = __import__('pkg_resources') \
        .get_distribution('sentry').version
except Exception as e:
    VERSION = 'unknown'


def _get_git_revision(path):
    if not os.path.exists(os.path.join(path, '.git')):
        return None
    try:
        revision = check_output(['git', 'rev-parse', 'HEAD'],
                                cwd=path, env=os.environ)
    except Exception:
        # binary didn't exist, wasn't on path, etc
        return None
    return revision.strip()


def get_revision():
    """
    :returns: Revision number of this branch/checkout, if available. None if
        no revision number can be determined.
    """
    if 'SENTRY_BUILD' in os.environ:
        return os.environ['SENTRY_BUILD']
    package_dir = os.path.dirname(__file__)
    checkout_dir = os.path.normpath(os.path.join(package_dir, os.pardir, os.pardir))
    path = os.path.join(checkout_dir)
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
