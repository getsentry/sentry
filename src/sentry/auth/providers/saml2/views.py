from sentry.auth.providers.saml2.forms import process_metadata
from sentry.auth.view import AuthView


def make_simple_setup(form_cls, template_path):
    class SelectIdP(AuthView):
        def handle(self, request, helper):
            form = process_metadata(form_cls, request, helper)

            if form:
                return self.respond(template_path, {"form": form})
            else:
                return helper.next_step()

    return SelectIdP
