from rest_framework.request import Request
from rest_framework.response import Response

from sentry.web.frontend.base import BaseView


class JavaScriptSdkDynamicLoader(BaseView):
    auth_required = False

    # Do not let an organization load trigger session, breaking Vary header.
    # TODO: This view should probably not be a subclass of BaseView if it doesn't actually use the
    # large amount of organization related support utilities, but that ends up being a large refactor.
    def determine_active_organization(self, request: Request, organization_slug=None) -> None:
        pass

    def get(self, request: Request, public_key: str, minified: str) -> Response:
        """Returns a JS file that dynamically loads the SDK based on project settings"""
        return super().get(request)
