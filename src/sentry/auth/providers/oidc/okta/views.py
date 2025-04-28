from django.http import HttpRequest, HttpResponseBase

from sentry.auth.view import AuthView

from .forms import OktaOIDCConfigureForm


class OktaOIDCConfigureView(AuthView):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def handle(self, request: HttpRequest, helper) -> HttpResponseBase:
        if request.method == "POST" and not request.POST.get("init"):
            form = OktaOIDCConfigureForm(request.POST)
            if form.is_valid():
                config = {
                    "domain": form.cleaned_data["domain"],
                    "client_id": form.cleaned_data["client_id"],
                    "client_secret": form.cleaned_data["client_secret"],
                    "sub": form.cleaned_data["client_id"],
                }
                helper.bind_state("config", config)
                return helper.next_step()
        else:
            form = OktaOIDCConfigureForm()

        return self.respond(
            "sentry_auth_okta_oidc/configure.html",
            {"form": form},
        )
