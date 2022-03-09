from django.urls import reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.auth.providers.saml2.forms import (
    AttributeMappingForm,
    SAMLForm,
    URLMetadataForm,
    XMLMetadataForm,
    process_metadata,
)
from sentry.auth.view import AuthView, ConfigureView
from sentry.utils.http import absolute_uri


class SAML2ConfigureView(ConfigureView):
    def dispatch(self, request: Request, organization, provider):
        sp_metadata_url = absolute_uri(
            reverse("sentry-auth-organization-saml-metadata", args=[organization.slug])
        )

        if request.method != "POST":
            saml_form = SAMLForm(provider.config["idp"])
            attr_mapping_form = AttributeMappingForm(provider.config["attribute_mapping"])
        else:
            saml_form = SAMLForm(request.POST)
            attr_mapping_form = AttributeMappingForm(request.POST)

            if saml_form.is_valid() and attr_mapping_form.is_valid():
                provider.config["idp"] = saml_form.cleaned_data
                provider.config["attribute_mapping"] = attr_mapping_form.cleaned_data
                provider.save()

        return self.render(
            "sentry_auth_saml2/configure.html",
            {
                "sp_metadata_url": sp_metadata_url,
                "forms": {"saml": saml_form, "attrs": attr_mapping_form},
            },
        )


class SelectIdP(AuthView):
    def handle(self, request: Request, helper) -> Response:
        op = "url"

        forms = {"url": URLMetadataForm(), "xml": XMLMetadataForm(), "idp": SAMLForm()}

        if "action_save" in request.POST:
            op = request.POST["action_save"]
            form_cls = forms[op].__class__
            forms[op] = process_metadata(form_cls, request, helper)

        # process_metadata will return None when the action was successful and
        # data was bound to the helper.
        if not forms[op]:
            return helper.next_step()

        return self.respond("sentry_auth_saml2/select-idp.html", {"op": op, "forms": forms})


class MapAttributes(AuthView):
    def handle(self, request: Request, helper) -> Response:
        if "save_mappings" not in request.POST:
            form = AttributeMappingForm()
        else:
            form = AttributeMappingForm(request.POST)
            if form.is_valid():
                helper.bind_state("attribute_mapping", form.cleaned_data)
                return helper.next_step()

        return self.respond("sentry_auth_saml2/map-attributes.html", {"form": form})
