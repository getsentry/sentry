"""
sentry.utils.data_filters.py
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import fnmatch


class FilterTypes(object):
    ERROR_MESSAGES = 'error_messages'
    RELEASES = 'releases'
    BLACKLISTED_IPS = 'blacklisted_ips'


def is_valid_release(release, project):
    """
    Verify that a release is not being filtered
    for the given project.
    """
    invalid_versions = project.get_option('sentry:{}'.format(FilterTypes.RELEASES))
    if not invalid_versions:
        return True

    for version in invalid_versions:
        if fnmatch.fnmatch(release.lower(), version.lower()):
            return False

    return True


def is_valid_error_message(message, project):
    """
    Verify that an error message is not being filtered
    for the given project.
    """
    filtered_errors = project.get_option('sentry:{}'.format(FilterTypes.ERROR_MESSAGES))
    if not filtered_errors:
        return True

    for error in filtered_errors:
        if fnmatch.fnmatch(message.lower(), error.lower()):
            return False

    return True
