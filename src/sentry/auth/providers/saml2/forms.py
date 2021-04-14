from django import forms
from django.forms.utils import ErrorList
from django.utils.encoding import force_text
from django.utils.translation import ugettext_lazy as _
from onelogin.saml2.idp_metadata_parser import OneLogin_Saml2_IdPMetadataParser

from sentry.http import safe_urlopen


def extract_idp_data_from_parsed_data(data):
    """
    Transform data returned by the OneLogin_Saml2_IdPMetadataParser into the
    expected IdP dict shape.
    """
    idp = data.get("idp", {})

    # In some scenarios the IDP sticks the x509cert in the x509certMulti
    # parameter
    cert = idp.get("x509cert", idp.get("x509certMulti", {}).get("signing", [None])[0])

    return {
        "entity_id": idp.get("entityId"),
        "sso_url": idp.get("singleSignOnService", {}).get("url"),
        "slo_url": idp.get("singleLogoutService", {}).get("url"),
        "x509cert": cert,
    }


def process_url(form):
    url = form.cleaned_data["metadata_url"]
    response = safe_urlopen(url)
    data = OneLogin_Saml2_IdPMetadataParser.parse(response.content)
    return extract_idp_data_from_parsed_data(data)


def process_xml(form):
    # cast unicode xml to byte string so lxml won't complain when trying to
    # parse a xml document with a type declaration.
    xml = form.cleaned_data["metadata_xml"].encode("utf8")
    data = OneLogin_Saml2_IdPMetadataParser.parse(xml)
    return extract_idp_data_from_parsed_data(data)


class URLMetadataForm(forms.Form):
    metadata_url = forms.URLField(label="Metadata URL")
    processor = process_url


class XMLMetadataForm(forms.Form):
    metadata_xml = forms.CharField(label="Metadata XML", widget=forms.Textarea)
    processor = process_xml


class SAMLForm(forms.Form):
    entity_id = forms.CharField(label="Entity ID")
    sso_url = forms.URLField(label="Single Sign On URL")
    slo_url = forms.URLField(label="Single Log Out URL", required=False)
    x509cert = forms.CharField(label="x509 public certificate", widget=forms.Textarea)
    processor = lambda d: d.cleaned_data


def process_metadata(form_cls, request, helper):
    form = form_cls()

    if "action_save" not in request.POST:
        return form

    form = form_cls(request.POST)

    if not form.is_valid():
        return form

    try:
        data = form_cls.processor(form)
    except Exception:
        errors = form._errors.setdefault("__all__", ErrorList())
        errors.append("Failed to parse provided SAML2 metadata")
        return form

    saml_form = SAMLForm(data)
    if not saml_form.is_valid():
        field_errors = [
            "{}: {}".format(k, ", ".join([force_text(i) for i in v]))
            for k, v in saml_form.errors.items()
        ]
        error_list = ", ".join(field_errors)

        errors = form._errors.setdefault("__all__", ErrorList())
        errors.append(f"Invalid metadata: {error_list}")
        return form

    helper.bind_state("idp", data)

    # Data is bound, do not respond with a form to signal the nexts steps
    return None


class AttributeMappingForm(forms.Form):
    # NOTE: These fields explicitly map to the sentry.auth.saml2.Attributes keys
    identifier = forms.CharField(
        label="IdP User ID",
        widget=forms.TextInput(attrs={"placeholder": "eg. user.uniqueID"}),
        help_text=_(
            "The IdPs unique ID attribute key for the user. This is "
            "what Sentry will used to identify the users identity from "
            "the identity provider."
        ),
    )
    user_email = forms.CharField(
        label="User Email",
        widget=forms.TextInput(attrs={"placeholder": "eg. user.email"}),
        help_text=_(
            "The IdPs email address attribute key for the "
            "user. Upon initial linking this will be used to identify "
            "the user in Sentry."
        ),
    )
    first_name = forms.CharField(label="First Name", required=False)
    last_name = forms.CharField(label="Last Name", required=False)
