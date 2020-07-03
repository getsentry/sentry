from __future__ import absolute_import

import sentry_plugins
import six
import sys

from sentry.exceptions import InvalidIdentity, PluginError

from sentry.shared_integrations.constants import (
    ERR_INTERNAL,
    ERR_UNAUTHORIZED,
    ERR_UNSUPPORTED_RESPONSE_TYPE,
)
from sentry.shared_integrations.exceptions import (
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
        ("Report Issue", "https://github.com/getsentry/sentry/issues"),
        ("View Source", "https://github.com/getsentry/sentry/tree/master/src/sentry_plugins"),
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
                msg = getattr(exc, "text", "unknown error")
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
