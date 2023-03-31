from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework.request import Request

from sentry.api.base import Endpoint, all_silo_endpoint


@all_silo_endpoint
class CatchallEndpoint(Endpoint):
    permission_classes = ()

    @csrf_exempt
    def dispatch(self, request: Request, *args, **kwargs) -> HttpResponse:
        """
        This endpoint handles routes that did not match
        """
        # Let the user know they may have forgotten a trailing slash
        if not request.path.endswith("/"):
            help = "Route not found, did you forget a trailing slash?"
            suggestion = f"try: {request.path}/"

            # Don't break JSON parsers
            if request.META.get("CONTENT_TYPE", "").startswith("application/json"):
                return JsonResponse(data={"info": f"{help} {suggestion}"}, status=404)

            # Produce error message with a pointer to the trailing slash in plain text
            arrow_offset = len(suggestion) - 1
            arrow = f"{' ' * arrow_offset}^"
            message = f"{help}\n\n{suggestion}\n{arrow}\n"

            return HttpResponse(message, status=404, content_type="text/plain")

        return HttpResponse(status=404)
