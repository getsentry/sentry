from datetime import datetime
from urllib.parse import urlparse

from django.contrib import messages
from django.contrib.auth import logout
from django.http import HttpResponse, HttpResponseServerError
from django.urls import reverse
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.csrf import csrf_exempt

from sentry import options
from sentry.auth.exceptions import IdentityNotValid
from sentry.auth.provider import Provider
from sentry.auth.view import AuthView
from sentry.models import AuthProvider, Organization, OrganizationStatus
from sentry.utils.auth import get_login_url
from sentry.utils.http import absolute_uri
from sentry.web.frontend.base import BaseView

try:
    from onelogin.saml2.auth import OneLogin_Saml2_Auth, OneLogin_Saml2_Settings
    from onelogin.saml2.constants import OneLogin_Saml2_Constants

    HAS_SAML2 = True
except ImportError:
    HAS_SAML2 = False

    def OneLogin_Saml2_Auth(*args, **kwargs):
        raise NotImplementedError("Missing SAML libraries")

    def OneLogin_Saml2_Settings(*args, **kwargs):
        raise NotImplementedError("Missing SAML libraries")

    class OneLogin_Saml2_ConstantsType(type):
        def __getattr__(self, attr):
            raise NotImplementedError("Missing SAML libraries")

    class OneLogin_Saml2_Constants(metaclass=OneLogin_Saml2_ConstantsType):
        pass


ERR_NO_SAML_SSO = _("The organization does not exist or does not have SAML SSO enabled.")
ERR_SAML_FAILED = _("SAML SSO failed, {reason}")


def get_provider(organization_slug):
    try:
        organization = Organization.objects.get(slug=organization_slug)
    except Organization.DoesNotExist:
        return None

    if organization.status != OrganizationStatus.VISIBLE:
        return None

    try:
        provider = AuthProvider.objects.get(organization=organization).get_provider()
    except AuthProvider.DoesNotExist:
        return None

    if not isinstance(provider, SAML2Provider):
        return None

    return provider


class SAML2LoginView(AuthView):
    def dispatch(self, request, helper):
        if "SAMLResponse" in request.POST:
            return helper.next_step()

        provider = helper.provider

        # During the setup pipeline, the provider will not have been configured yet,
        # so build the config first from the state.
        if not provider.config:
            provider.config = provider.build_config(helper.fetch_state())

        saml_config = build_saml_config(provider.config, helper.organization.slug)
        auth = build_auth(request, saml_config)

        return self.redirect(auth.login())


# With SAML, the SSO request can be initiated by both the Service Provider
# (sentry) (the typical case) and the Identity Provider. In the second case,
# the auth assertion is directly posted to the ACS URL. Because the user will
# not have initiated their SSO flow we must provide a endpoint similar to
# auth_provider_login, but with support for initing the auth flow.
class SAML2AcceptACSView(BaseView):
    @method_decorator(csrf_exempt)
    def dispatch(self, request, organization_slug):
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
        try:
            organization = Organization.objects.get(slug=organization_slug)
        except Organization.DoesNotExist:
            messages.add_message(request, messages.ERROR, ERR_NO_SAML_SSO)
            return self.redirect(reverse("sentry-login"))

        try:
            auth_provider = AuthProvider.objects.get(organization=organization)
        except AuthProvider.DoesNotExist:
            messages.add_message(request, messages.ERROR, ERR_NO_SAML_SSO)
            return self.redirect(reverse("sentry-login"))

        helper = AuthHelper(
            request=request,
            organization=organization,
            auth_provider=auth_provider,
            flow=AuthHelper.FLOW_LOGIN,
        )

        helper.init_pipeline()
        return helper.current_step()


class SAML2ACSView(AuthView):
    @method_decorator(csrf_exempt)
    def dispatch(self, request, helper):
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

        # Not all providers send a session expiration value, but if they do,
        # we should respect it and set session cookies to expire at the given time.
        if auth.get_session_expiration() is not None:
            session_expiration = datetime.fromtimestamp(auth.get_session_expiration()).replace(
                tzinfo=timezone.utc
            )
            request.session.set_expiry(session_expiration)

        return helper.next_step()


class SAML2SLSView(BaseView):
    @method_decorator(csrf_exempt)
    def dispatch(self, request, organization_slug):
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
    def dispatch(self, request, organization_slug):
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


class SAML2Provider(Provider):
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

    required_feature = "organizations:sso-saml2"

    def get_auth_pipeline(self):
        return [SAML2LoginView(), SAML2ACSView()]

    def get_setup_pipeline(self):
        return self.get_saml_setup_pipeline() + self.get_auth_pipeline()

    def get_saml_setup_pipeline(self):
        """
        Return a list of AuthViews to setup the SAML provider.

        The setup AuthView(s) must bind the `idp` parameter into the helper
        state.
        """
        raise NotImplementedError

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
            attributes[key] = raw_attributes.get(provider_key, [""])[0]

        # Email and identifier MUST be correctly mapped
        if not attributes[Attributes.IDENTIFIER] or not attributes[Attributes.USER_EMAIL]:
            raise IdentityNotValid(
                _(
                    "Failed to map SAML attributes. Assertion returned the following attribute keys: %(keys)s"
                )
                % {"keys": raw_attributes.keys()}
            )

        name = (attributes[k] for k in (Attributes.FIRST_NAME, Attributes.LAST_NAME))
        name = " ".join([_f for _f in name if _f])

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
