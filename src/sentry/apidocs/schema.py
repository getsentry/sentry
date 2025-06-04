from drf_spectacular.openapi import AutoSchema
from drf_spectacular.plumbing import get_doc


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
