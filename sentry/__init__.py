"""
Sentry
~~~~~~
"""

__all__ = ('__version__', '__build__', '__docformat__', 'get_revision')
__version__ = (1, 3, 13)
__docformat__ = 'restructuredtext en'

import os

def _get_git_revision(path):
    revision_file = os.path.join(path, 'refs', 'heads', 'master')
    if not os.path.exists(revision_file):
        return None
    fh = open(revision_file, 'r')
    try:
        return fh.read().strip()
    finally:
        fh.close()

def get_revision():
    """
    :returns: Revision number of this branch/checkout, if available. None if
        no revision number can be determined.
    """
    package_dir = os.path.dirname(__file__)
    checkout_dir = os.path.normpath(os.path.join(package_dir, '..'))
    path = os.path.join(checkout_dir, '.git')
    if os.path.exists(path):
        return _get_git_revision(path)
    return None

__build__ = get_revision()

def get_version():
    base = '.'.join(map(str, __version__))
    if __build__:
        base = '%s (%s)' % (base, __build__)
    return base