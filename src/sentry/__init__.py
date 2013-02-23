"""
sentry
~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import os
import os.path

try:
    VERSION = __import__('pkg_resources') \
        .get_distribution('sentry').version
except Exception, e:
    VERSION = 'unknown'


def _get_git_revision(path):
    revision_file = os.path.join(path, 'refs', 'heads', 'master')
    if not os.path.exists(revision_file):
        return None
    fh = open(revision_file, 'r')
    try:
        return fh.read().strip()[:7]
    finally:
        fh.close()


def get_revision():
    """
    :returns: Revision number of this branch/checkout, if available. None if
        no revision number can be determined.
    """
    package_dir = os.path.dirname(__file__)
    checkout_dir = os.path.normpath(os.path.join(package_dir, os.pardir, os.pardir))
    path = os.path.join(checkout_dir, '.git')
    if os.path.exists(path):
        return _get_git_revision(path)
    return None


def get_version():
    base = VERSION
    if __build__:
        base = '%s (%s)' % (base, __build__)
    return base

__build__ = get_revision()
__docformat__ = 'restructuredtext en'
