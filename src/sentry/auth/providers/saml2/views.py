from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry.auth.providers.saml2.forms import process_metadata
from sentry.auth.view import AuthView


def make_simple_setup(form_cls, template_path: str) -> type[AuthView]:
    class SelectIdP(AuthView):
        def handle(self, request: HttpRequest, pipeline) -> HttpResponseBase:
            form = process_metadata(form_cls, request, pipeline)

            if form:
                return self.respond(template_path, {"form": form})
            else:
                return pipeline.next_step()

    return SelectIdP
