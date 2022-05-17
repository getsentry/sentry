from rest_framework.request import Request

from sentry.web.frontend.react_page import GenericReactPageView


class SharedGroupDetailsView(GenericReactPageView):
    def meta_tags(self, request: Request):
        return [{"property": "hello", "content": "world"}]
