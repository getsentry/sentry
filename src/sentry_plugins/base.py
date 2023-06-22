from __future__ import annotations

import logging
import sys
from typing import Any, NoReturn

import sentry_plugins
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


class CorePluginMixin:
    author: str | None = "Sentry Team"
    author_url: str | None = "https://github.com/getsentry/sentry"
    version: str | None = sentry_plugins.VERSION
    resource_links = [
        ("Report Issue", "https://github.com/getsentry/sentry/issues"),
        ("View Source", "https://github.com/getsentry/sentry/tree/master/src/sentry_plugins"),
    ]

    # HACK(dcramer): work around MRO issue with plugin metaclass
    logger: logging.Logger | None = None

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
            return f"Error Communicating with {self.title} (HTTP {exc.code}): {msg}"
        else:
            return ERR_INTERNAL

    def raise_error(self, exc: BaseException, identity: Any = None) -> NoReturn:
        if isinstance(exc, ApiUnauthorized):
            raise InvalidIdentity(self.message_from_error(exc), identity=identity).with_traceback(
                sys.exc_info()[2]
            )
        elif isinstance(exc, ApiError):
            raise PluginError(self.message_from_error(exc)).with_traceback(sys.exc_info()[2])
        elif isinstance(exc, PluginError):
            raise
        else:
            self.logger.exception(str(exc))
            raise PluginError(self.message_from_error(exc)).with_traceback(sys.exc_info()[2])
