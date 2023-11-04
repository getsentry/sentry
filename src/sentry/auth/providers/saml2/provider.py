import abc
from urllib.parse import urlparse

from django.contrib import messages
from django.contrib.auth import logout
from django.http import HttpResponse, HttpResponseServerError
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.utils.translation import gettext_lazy as _
from django.views.decorators.csrf import csrf_exempt
from onelogin.saml2.auth import OneLogin_Saml2_Auth, OneLogin_Saml2_Settings
from onelogin.saml2.constants import OneLogin_Saml2_Constants
from rest_framework.request import Request

from sentry import options
from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.provider import Provider
from sentry.auth.view import AuthView
from sentry.models.authprovider import AuthProvider
from sentry.models.organization import OrganizationStatus
from sentry.models.organizationmapping import OrganizationMapping
from sentry.services.hybrid_cloud.organization import organization_service
from sentry.utils.auth import get_login_url
from sentry.utils.http import absolute_uri
from sentry.web.frontend.base import BaseView, control_silo_view

ERR_NO_SAML_SSO = _("The organization does not exist or does not have SAML SSO enabled.")
ERR_SAML_FAILED = _("SAML SSO failed, {reason}")


def get_provider(organization_slug):
    try:
        mapping = OrganizationMapping.objects.get(slug=organization_slug)
    except OrganizationMapping.DoesNotExist:
        return None

    if mapping.status != OrganizationStatus.ACTIVE:
        return None

    try:
        provider = AuthProvider.objects.get(organization_id=mapping.organization_id).get_provider()
    except AuthProvider.DoesNotExist:
        return None

    if not isinstance(provider, SAML2Provider):
        return None

    return provider


class SAML2LoginView(AuthView):
    def dispatch(self, request: Request, helper) -> HttpResponse:
        if "SAMLResponse" in request.POST:
            return helper.next_step()

        provider = helper.provider

        # During the setup pipeline, the provider will not have been configured yet,
        # so build the config first from the state.
        if not provider.config:
            provider.config = provider.build_config(helper.fetch_state())

        if request.subdomain:
            # See auth.helper.handle_existing_identity()
            helper.bind_state("subdomain", request.subdomain)

        saml_config = build_saml_config(provider.config, helper.organization.slug)
        auth = build_auth(request, saml_config)

        return self.redirect(auth.login())


# With SAML, the SSO request can be initiated by both the Service Provider
# (sentry) (the typical case) and the Identity Provider. In the second case,
# the auth assertion is directly posted to the ACS URL. Because the user will
# not have initiated their SSO flow we must provide a endpoint similar to
# auth_provider_login, but with support for initializing the auth flow.
@control_silo_view
class SAML2AcceptACSView(BaseView):
    @method_decorator(csrf_exempt)
    def dispatch(self, request: Request, organization_slug):
        from sentry.auth.helper import AuthHelper

        helper = AuthHelper.get_for_request(request)

        # SP initiated authentication, request helper is provided
        if helper:
            from sentry.web.frontend.auth_provider_login import AuthProviderLoginView

            sso_login = AuthProviderLoginView()
            return sso_login.handle(request)

        # IdP initiated authentication. The organization_slug must be valid and
        # an auth provider must exist for this organization to proceed with
        # IdP initiated SAML auth.
        org_context = organization_service.get_organization_by_slug(
            slug=organization_slug, only_visible=False
        )
        if org_context is None:
            messages.add_message(request, messages.ERROR, ERR_NO_SAML_SSO)
            return self.redirect(reverse("sentry-login"))

        try:
            auth_provider = AuthProvider.objects.get(organization_id=org_context.organization.id)
        except AuthProvider.DoesNotExist:
            messages.add_message(request, messages.ERROR, ERR_NO_SAML_SSO)
            return self.redirect(reverse("sentry-login"))

        helper = AuthHelper(
            request=request,
            organization=(org_context.organization),
            auth_provider=auth_provider,
            flow=AuthHelper.FLOW_LOGIN,
        )

        helper.initialize()
        return helper.current_step()


class SAML2ACSView(AuthView):
    @method_decorator(csrf_exempt)
    def dispatch(self, request: Request, helper) -> HttpResponse:
        provider = helper.provider

        # If we're authenticating during the setup pipeline the provider will
        # not have been configured yet, build the config first from the state
        if not provider.config:
            provider.config = provider.build_config(helper.fetch_state())

        saml_config = build_saml_config(provider.config, helper.organization.slug)

        auth = build_auth(request, saml_config)
        auth.process_response()

        # SSO response verification failed
        if auth.get_errors():
            return helper.error(ERR_SAML_FAILED.format(reason=auth.get_last_error_reason()))

        helper.bind_state("auth_attributes", auth.get_attributes())

        return helper.next_step()


class SAML2SLSView(BaseView):
    @method_decorator(csrf_exempt)
    def dispatch(self, request: Request, organization_slug):
        provider = get_provider(organization_slug)
        if provider is None:
            messages.add_message(request, messages.ERROR, ERR_NO_SAML_SSO)
            return self.redirect("/")

        saml_config = build_saml_config(provider.config, organization_slug)
        auth = build_auth(request, saml_config)

        # No need to logout an anonymous user.
        should_logout = request.user.is_authenticated

        def force_logout():
            logout(request)

        redirect_to = auth.process_slo(
            delete_session_cb=force_logout, keep_local_session=not should_logout
        )

        if not redirect_to:
            redirect_to = get_login_url()

        return self.redirect(redirect_to)


class SAML2MetadataView(BaseView):
    def dispatch(self, request: Request, organization_slug):
        provider = get_provider(organization_slug)
        config = provider.config if provider else {}

        saml_config = build_saml_config(config, organization_slug)
        saml_settings = OneLogin_Saml2_Settings(settings=saml_config, sp_validation_only=True)
        metadata = saml_settings.get_sp_metadata()
        errors = saml_settings.validate_metadata(metadata)

        if len(errors) > 0:
            message = "\n".join(errors)
            return HttpResponseServerError(content=message, content_type="plain/text")

        return HttpResponse(content=metadata, content_type="text/xml")


class Attributes:
    IDENTIFIER = "identifier"
    USER_EMAIL = "user_email"
    FIRST_NAME = "first_name"
    LAST_NAME = "last_name"


class SAML2Provider(Provider, abc.ABC):
    """
    Base SAML2 Authentication provider. SAML style authentication plugins
    should implement this.

    - The provider must implement the `get_configure_view`.

    - The provider must implement the `get_saml_setup_pipeline`. The
      AuthView(s) passed in this method MUST bind the `idp` configuration
      object. The dict should match the shape:

      >>> state.get('idp')
      {
        'entity_id': # Identity Provider entity ID. Usually a URL
        'x509cert':  # Identity Provider x509 public certificate
        'sso_url':   # Identity Provider Single Sign-On URL
        'slo_url':   # identity Provider Single Sign-Out URL
      }

      The provider may also bind the `advanced` configuration. This dict
      provides advanced SAML configurations. The dict should match the shape:

      HINT: You *probably* don't need this.

      >>> state.get('advanced')
      {
        'authn_request_signed':     # Sign the authentication request?
        'logout_request_signed':    # Sign the logout request?
        'logout_response_signed':   # Sign the logout response?
        'metadata_signed':          # Sign the metadata?
        'want_message_signed':      # Expect signed message
        'want_assertion_signed':    # Expect signed assertions
        'want_assertion_encrypted': # Expect encrypted assertions
        'signature_algorithm':      # Algorithm used to sign / verify requests / responses
        'digest_algorithm':         # Algorithm used to generate / verify digests
        'x509cert':                 # Public Service Provider key
        'private_key':              # Private Key used for signing / encryption
      }

    - The provider must EITHER specify an attribute mapping by implementing the
      `attribute_mapping` method OR bind the `attribute_mapping` key to the
      state during setup. The attribute mapping should map the `Attributes`
      constants to the Identity Provider attribute keys.
    """

    # SAML does nothing with refresh state -- don't waste resources calling it in check_auth job.
    requires_refresh = False
    required_feature = "organizations:sso-saml2"

    def get_auth_pipeline(self):
        return [SAML2LoginView(), SAML2ACSView()]

    def get_setup_pipeline(self):
        return self.get_saml_setup_pipeline() + self.get_auth_pipeline()

    @abc.abstractmethod
    def get_saml_setup_pipeline(self):
        """
        Return a list of AuthViews to setup the SAML provider.

        The setup AuthView(s) must bind the `idp` parameter into the helper
        state.
        """
        pass

    def attribute_mapping(self):
        """
        Returns the default Attribute Key -> IdP attribute key mapping.

        This value will be merged into the configuration by self.build_config,
        however, should a attribute_mapping exist in the helper state at
        configuration build time, these may be overridden.
        """
        return {}

    def build_config(self, state):
        config = state

        # Default attribute mapping if none bound
        if "attribute_mapping" not in config:
            config["attribute_mapping"] = self.attribute_mapping()

        return config

    def build_identity(self, state):
        raw_attributes = state["auth_attributes"]
        attributes = {}

        # map configured provider attributes
        for key, provider_key in self.config["attribute_mapping"].items():
            attribute_list = raw_attributes.get(provider_key, [""])
            attributes[key] = attribute_list[0] if len(attribute_list) > 0 else ""

        # Email and identifier MUST be correctly mapped
        if not attributes[Attributes.IDENTIFIER] or not attributes[Attributes.USER_EMAIL]:
            error_msg_keys = ", ".join(repr(key) for key in sorted(raw_attributes.keys()))
            raise IdentityNotValid(
                _(
                    f"Failed to map SAML attributes. Assertion returned the following attribute keys: {error_msg_keys}"
                )
            )

        name = (attributes[k] for k in (Attributes.FIRST_NAME, Attributes.LAST_NAME))
        name = " ".join(_f for _f in name if _f)

        return {
            "id": attributes[Attributes.IDENTIFIER],
            "email": attributes[Attributes.USER_EMAIL],
            "name": name,
        }

    def refresh_identity(self, auth_identity):
        # Nothing to refresh
        return


def build_saml_config(provider_config, org):
    """
    Construct the SAML configuration dict to be passed into the OneLogin SAML
    library.

    For more details about the structure of this object see the
    SAML2Provider.build_config method.
    """
    avd = provider_config.get("advanced", {})

    security_config = {
        "authnRequestsSigned": avd.get("authn_request_signed", False),
        "logoutRequestSigned": avd.get("logout_request_signed", False),
        "logoutResponseSigned": avd.get("logout_response_signed", False),
        "signMetadata": avd.get("metadata_signed", False),
        "wantMessagesSigned": avd.get("want_message_signed", False),
        "wantAssertionsSigned": avd.get("want_assertion_signed", False),
        "wantAssertionsEncrypted": avd.get("want_assertion_encrypted", False),
        "signatureAlgorithm": avd.get("signature_algorithm", OneLogin_Saml2_Constants.RSA_SHA256),
        "digestAlgorithm": avd.get("digest_algorithm", OneLogin_Saml2_Constants.SHA256),
        "wantNameId": False,
        "requestedAuthnContext": False,
    }

    # TODO(epurkhiser): This is also available in the helper and should probably come from there.
    acs_url = absolute_uri(reverse("sentry-auth-organization-saml-acs", args=[org]))
    sls_url = absolute_uri(reverse("sentry-auth-organization-saml-sls", args=[org]))
    metadata_url = absolute_uri(reverse("sentry-auth-organization-saml-metadata", args=[org]))

    saml_config = {
        "strict": True,
        "sp": {
            "entityId": metadata_url,
            "assertionConsumerService": {
                "url": acs_url,
                "binding": OneLogin_Saml2_Constants.BINDING_HTTP_POST,
            },
            "singleLogoutService": {
                "url": sls_url,
                "binding": OneLogin_Saml2_Constants.BINDING_HTTP_REDIRECT,
            },
        },
        "security": security_config,
    }

    idp = provider_config.get("idp")

    if idp is not None:
        saml_config["idp"] = {
            "entityId": idp["entity_id"],
            "x509cert": idp["x509cert"],
            "singleSignOnService": {"url": idp["sso_url"]},
            "singleLogoutService": {"url": idp["slo_url"]},
        }

    if avd.get("x509cert") is not None:
        saml_config["sp"]["x509cert"] = avd["x509cert"]

    if avd.get("private_key") is not None:
        saml_config["sp"]["privateKey"] = avd["private_key"]

    return saml_config


def build_auth(request, saml_config):
    """
    Construct a OneLogin_Saml2_Auth object for the current request.
    """
    url = urlparse(options.get("system.url-prefix"))
    saml_request = {
        "https": "on" if url.scheme == "https" else "off",
        "http_host": url.hostname,
        "script_name": request.META["PATH_INFO"],
        "server_port": url.port,
        "get_data": request.GET.copy(),
        "post_data": request.POST.copy(),
    }

    return OneLogin_Saml2_Auth(saml_request, saml_config)
