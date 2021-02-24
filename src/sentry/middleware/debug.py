from django.conf import settings


class NoIfModifiedSinceMiddleware:
    def __init__(self):
        if not settings.DEBUG:
            from django.core.exceptions import MiddlewareNotUsed

            raise MiddlewareNotUsed

    def process_request(self, request):
        request.META.pop("HTTP_IF_MODIFIED_SINCE", None)
