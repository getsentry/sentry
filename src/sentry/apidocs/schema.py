from drf_spectacular.openapi import AutoSchema
from drf_spectacular.plumbing import get_doc

from sentry.api.helpers.deprecation import (
    OPENAPI_DEPRECATED_ATTR,
    OPENAPI_DEPRECATED_URL_NAMES_ATTR,
)

URL_NAME_ATTR = "_sentry_url_name"


class SentrySchema(AutoSchema):
    """DRF Documentation Schema for sentry endpoints"""

    @property
    def view_func(self):
        return getattr(self.view, self.method.lower())

    def get_operation_id(self) -> str:
        """
        First line of an endpoint's docstring is the operation IDZ
        """
        docstring = get_doc(self.view_func).splitlines()
        if len(docstring) > 1:
            return docstring[0]
        return super().get_operation_id()

    def get_description(self) -> str:  # type: ignore[override]
        """
        Docstring is used as a description for the endpoint. The operation ID is included in this.
        """
        docstring = get_doc(self.view_func)
        if len(docstring.splitlines()) > 1:
            return docstring
        return super().get_description()

    def is_deprecated(self) -> bool:
        if super().is_deprecated():
            return True

        func = self.view_func
        while func is not None:
            if getattr(func, OPENAPI_DEPRECATED_ATTR, False):
                url_names = getattr(func, OPENAPI_DEPRECATED_URL_NAMES_ATTR, None)
                if not url_names:
                    return True
                return getattr(self.view, URL_NAME_ATTR, None) in url_names
            func = getattr(func, "__wrapped__", None)

        return False
