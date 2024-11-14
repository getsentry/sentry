from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.utils.deprecation import MiddlewareMixin

class CSPMiddleware(MiddlewareMixin):
    def process_request(self, request: HttpRequest) -> None: ...
    def process_response(
        self, request: HttpRequest, response: HttpResponseBase
    ) -> HttpResponseBase: ...
    def build_policy(self, request: HttpRequest, response: HttpResponseBase) -> str: ...
