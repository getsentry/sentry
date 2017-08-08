"""
sentry.utils.data_filters.py
~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import fnmatch
import ipaddress
import six


class FilterTypes(object):
    ERROR_MESSAGES = 'error_messages'
    RELEASES = 'releases'


def is_valid_ip(project, ip_address):
    """
    Verify that an IP address is not being blacklisted
    for the given project.
    """
    blacklist = project.get_option('sentry:blacklisted_ips')
    if not blacklist:
        return True

    for addr in blacklist:
        # We want to error fast if it's an exact match
        if ip_address == addr:
            return False

        # Check to make sure it's actually a range before
        try:
            if '/' in addr and (
                ipaddress.ip_address(six.text_type(ip_address)) in ipaddress.ip_network(
                    six.text_type(addr), strict=False
                )
            ):
                return False
        except ValueError:
            # Ignore invalid values here
            pass

    return True


def is_valid_release(project, release):
    """
    Verify that a release is not being filtered
    for the given project.
    """
    release = six.text_type(release).lower()
    invalid_versions = project.get_option('sentry:{}'.format(FilterTypes.RELEASES))
    if not invalid_versions:
        return True

    for version in invalid_versions:
        if fnmatch.fnmatch(release, version.lower()):
            return False

    return True


def is_valid_error_message(project, message):
    """
    Verify that an error message is not being filtered
    for the given project.
    """
    message = six.text_type(message).lower()
    filtered_errors = project.get_option('sentry:{}'.format(FilterTypes.ERROR_MESSAGES))
    if not filtered_errors:
        return True

    for error in filtered_errors:
        if fnmatch.fnmatch(message, error.lower()):
            return False

    return True
