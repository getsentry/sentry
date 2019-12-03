from __future__ import absolute_import

import pkg_resources
import sentry_plugins
import six
import sys

from sentry.exceptions import InvalidIdentity, PluginError

from sentry_plugins.constants import ERR_INTERNAL, ERR_UNAUTHORIZED, ERR_UNSUPPORTED_RESPONSE_TYPE
from sentry_plugins.exceptions import (
    ApiError,
    ApiHostError,
    ApiUnauthorized,
    UnsupportedResponseType,
)


class CorePluginMixin(object):
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    version = sentry_plugins.VERSION
    resource_links = [
        ("Bug Tracker", "https://github.com/getsentry/sentry/issues"),
        ("Source", "https://github.com/getsentry/sentry"),
    ]

    # HACK(dcramer): work around MRO issue with plugin metaclass
    logger = None

    # TODO(dcramer): The following is a possible "better implementation" of the
    # core issue implementation, though it would need a compat layer to push
    # it upstream
    def error_message_from_json(self, data):
        return data.get("message", "unknown error")

    def message_from_error(self, exc):
        if isinstance(exc, ApiUnauthorized):
            return ERR_UNAUTHORIZED
        elif isinstance(exc, ApiHostError):
            return exc.text
        elif isinstance(exc, UnsupportedResponseType):
            return ERR_UNSUPPORTED_RESPONSE_TYPE.format(content_type=exc.content_type)
        elif isinstance(exc, ApiError):
            if exc.json:
                msg = self.error_message_from_json(exc.json) or "unknown error"
            else:
                msg = "unknown error"
            return "Error Communicating with %s (HTTP %s): %s" % (self.title, exc.code, msg)
        else:
            return ERR_INTERNAL

    def raise_error(self, exc, identity=None):
        if isinstance(exc, ApiUnauthorized):
            six.reraise(
                InvalidIdentity,
                InvalidIdentity(self.message_from_error(exc), identity=identity),
                sys.exc_info()[2],
            )
        elif isinstance(exc, ApiError):
            six.reraise(PluginError, PluginError(self.message_from_error(exc)), sys.exc_info()[2])
        elif isinstance(exc, PluginError):
            raise
        else:
            self.logger.exception(six.text_type(exc))
            six.reraise(PluginError, PluginError(self.message_from_error(exc)), sys.exc_info()[2])


def assert_package_not_installed(name):
    try:
        pkg_resources.get_distribution(name)
    except pkg_resources.DistributionNotFound:
        return
    else:
        raise RuntimeError(
            "Found %r. This has been superseded by 'sentry-plugins', so please uninstall." % name
        )
