from __future__ import absolute_import, print_function

from django import forms
from django.conf import settings
from django.core.urlresolvers import reverse
from django.contrib.auth import logout
from django.contrib.auth.models import AnonymousUser
from django.http import (
    HttpResponse, HttpResponseRedirect, HttpResponseServerError,
    Http404, HttpResponseNotAllowed
)
from django.utils.decorators import method_decorator
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.csrf import csrf_exempt
from six.moves.urllib.parse import urlparse

from onelogin.saml2.constants import OneLogin_Saml2_Constants

from sentry import options
from sentry.auth import Provider, AuthView
from sentry.auth.view import ConfigureView
from sentry.auth.exceptions import IdentityNotValid
from sentry.models import (AuthProvider, Organization, OrganizationStatus, User, UserEmail)
from sentry.utils.http import absolute_uri
from sentry.utils.auth import login, get_login_redirect, get_login_url


IDENTIFIER_CHOICES = (
    ("email", "email"),
    ("username", "username"),
)

NAMEID_FORMAT_CHOICES = (
    (OneLogin_Saml2_Constants.NAMEID_UNSPECIFIED, 'unspecified'),
    (OneLogin_Saml2_Constants.NAMEID_EMAIL_ADDRESS, 'emailAddress'),
    (OneLogin_Saml2_Constants.NAMEID_TRANSIENT, 'transient'),
    (OneLogin_Saml2_Constants.NAMEID_PERSISTENT, 'persistent'),
    (OneLogin_Saml2_Constants.NAMEID_ENTITY, 'entity'),
    (OneLogin_Saml2_Constants.NAMEID_ENCRYPTED, 'encrypted'),
    (OneLogin_Saml2_Constants.NAMEID_KERBEROS, 'kerberos'),
    (OneLogin_Saml2_Constants.NAMEID_X509_SUBJECT_NAME, 'x509subjecname'),
    (OneLogin_Saml2_Constants.NAMEID_WINDOWS_DOMAIN_QUALIFIED_NAME, 'windowsdomainqualifiedname')
)

AUTHNCONTEXT_CHOICES = (
    (OneLogin_Saml2_Constants.AC_UNSPECIFIED, OneLogin_Saml2_Constants.AC_UNSPECIFIED),
    (OneLogin_Saml2_Constants.AC_PASSWORD, OneLogin_Saml2_Constants.AC_PASSWORD),
    (OneLogin_Saml2_Constants.AC_PASSWORD_PROTECTED, OneLogin_Saml2_Constants.AC_PASSWORD_PROTECTED),
    (OneLogin_Saml2_Constants.AC_X509, OneLogin_Saml2_Constants.AC_X509),
    (OneLogin_Saml2_Constants.AC_SMARTCARD, OneLogin_Saml2_Constants.AC_SMARTCARD),
    (OneLogin_Saml2_Constants.AC_KERBEROS, OneLogin_Saml2_Constants.AC_KERBEROS)
)

SIGNATURE_ALGORITHM_CHOICES = (
    (OneLogin_Saml2_Constants.RSA_SHA256, 'RSA_SHA256'),
    (OneLogin_Saml2_Constants.RSA_SHA384, 'RSA_SHA384'),
    (OneLogin_Saml2_Constants.RSA_SHA512, 'RSA_SHA512'),
    (OneLogin_Saml2_Constants.RSA_SHA1, 'RSA_SHA1'),
    (OneLogin_Saml2_Constants.DSA_SHA1, 'DSA_SHA1')
)

DIGEST_ALGORITHM_CHOICES = (
    (OneLogin_Saml2_Constants.SHA256, 'SHA256'),
    (OneLogin_Saml2_Constants.SHA384, 'SHA384'),
    (OneLogin_Saml2_Constants.SHA512, 'SHA512'),
    (OneLogin_Saml2_Constants.SHA1, 'SHA1')
)

try:
    from onelogin.saml2.auth import OneLogin_Saml2_Auth, OneLogin_Saml2_Settings
    HAS_SAML2 = True
except ImportError:
    HAS_SAML2 = False

    def OneLogin_Saml2_Auth(*args, **kwargs):
        raise NotImplementedError('Missing SAML libraries')

    def OneLogin_Saml2_Settings(*args, **kwargs):
        raise NotImplementedError('Missing SAML libraries')


def get_provider(organization_slug):
    try:
        organization = Organization.objects.get(slug=organization_slug)
    except Organization.DoesNotExist:
        return None

    if organization.status != OrganizationStatus.VISIBLE:
        return None

    try:
        auth_provider = AuthProvider.objects.get(organization=organization)
        return auth_provider.get_provider()
    except AuthProvider.DoesNotExist:
        return None


class OptionsForm(forms.Form):
    options_identifier = forms.ChoiceField(label="Identifier attribute", choices=IDENTIFIER_CHOICES, help_text=_('Select what field will be used in order to match the user account.'))
    options_jit = forms.BooleanField(label="Just-in-time Provisioning", required=False, help_text=_('Auto-provisioning. If user not exists, Sentry will create a new user account with the data provided by the IdP.'))
    options_slo = forms.BooleanField(label="Single Logout Service", required=False, help_text=_('Enable/disable Single Log Out. SLO  is a complex functionality, the most common SLO implementation is based on front-channel (redirections), sometimes if the SLO workflow fails a user can be blocked in an unhandled view. If the admin does not controls the set of apps involved in the SLO process maybe is better to disable this functionality (can carry more problems than benefits).'))

    def clean(self):
        super(OptionsForm, self).clean()

        options_identifier = self.data.get('options_identifier', None)
        if (options_identifier is None or options_identifier == 'email') and not self.data.get('attribute_mapping_email', None):
            self._errors["options_identifier"] = [_("Email selected as identifier but its mapping not provided")]
            del self.cleaned_data["options_identifier"]
        elif (options_identifier == 'username') and not self.data.get('attribute_mapping_username', None):
            self._errors["options_identifier"] = [_("Username selected as identifier but its mapping not provided")]
            del self.cleaned_data["options_identifier"]

        if self.data.get('options_jit', None) and not (self.data.get('attribute_mapping_email', None) and self.data.get('attribute_mapping_username', None) and self.data.get('attribute_mapping_displayname', None)):
            self._errors["options_jit"] = [_("JIT enabled but required attribute mapping not provided")]
            del self.cleaned_data["options_jit"]

        if self.data.get('options_slo', None) and not self.data.get('idp_slo_url', None):
            self._errors["options_slo"] = [_("SLO enabled but Single Logout Service URL not provided")]
            del self.cleaned_data["options_slo"]

        return self.cleaned_data


class AttributeMappingForm(forms.Form):
    attribute_mapping_email = forms.CharField(label='Email', required=False)
    attribute_mapping_username = forms.CharField(label='Username', required=False)
    attribute_mapping_displayname = forms.CharField(label='Display Name', required=False)


class SAML2ConfigureView(ConfigureView):
    saml_form_cls = None
    advanced_form_cls = None

    def dispatch(self, request, organization, auth_provider):
        if self.saml_form_cls is None or self.advanced_form_cls is None:
            raise NotImplementedError('Custom forms may be defined by the extended class')

        if request.POST:
            data = request.POST
            saml_form = self.saml_form_cls(data)
            options_form = OptionsForm(data)
            attr_mapping_form = AttributeMappingForm(data)
            advanced_form = self.advanced_form_cls(data)

            valid_forms = 0
            if saml_form.is_valid():
                idp_data = SAML2Provider.extract_idp_data_from_form(saml_form)
                auth_provider.config['idp'] = idp_data
                valid_forms += 1
            if options_form.is_valid():
                options_data = SAML2Provider.extract_options_data_from_form(options_form)
                auth_provider.config['options'] = options_data
                valid_forms += 1
            if attr_mapping_form.is_valid():
                attribute_mapping_data = SAML2Provider.extract_attribute_mapping_from_form(attr_mapping_form)
                auth_provider.config['attribute_mapping'] = attribute_mapping_data
                valid_forms += 1
            if advanced_form.is_valid():
                advanced_settings_data = SAML2Provider.extract_advanced_settings_from_form(advanced_form)
                auth_provider.config['advanced_settings'] = advanced_settings_data
                valid_forms += 1
            if valid_forms == 4:
                auth_provider.save()
        else:
            idp_data = auth_provider.config.get('idp', None)
            saml_form = self.saml_form_cls(initial=idp_data)

            options_data = auth_provider.config.get('options', None)
            options_form = OptionsForm(initial=options_data)

            attr_mapping_data = auth_provider.config.get('attribute_mapping', None)
            attr_mapping_form = AttributeMappingForm(initial=attr_mapping_data)

            advanced_data = auth_provider.config.get('advanced_settings', None)
            advanced_form = self.advanced_form_cls(initial=advanced_data)

        return self.display_configure_view(organization, saml_form, options_form, attr_mapping_form, advanced_form)

    def display_configure_view(self, organization, saml_form, options_form, attr_mapping_form, advanced_form):
        raise NotImplementedError('Display Configure View not implemented!')


class SAML2LoginView(AuthView):
    def dispatch(self, request, helper):
        provider = helper.provider
        if provider is None:
            raise Http404
        saml_config = provider.build_saml_config(helper.organization.slug)
        auth = provider.build_auth(request, saml_config)
        return self.redirect(auth.login())


class SAML2ACSView(AuthView):
    @method_decorator(csrf_exempt)
    def dispatch(self, request, organization_slug):
        if request.method != 'POST':
            return HttpResponseNotAllowed(['POST'])

        provider = get_provider(organization_slug)
        if provider is None:
            raise Http404

        organization = Organization.objects.get(slug=organization_slug)
        saml_config = provider.build_saml_config(organization_slug)

        auth = provider.build_auth(request, saml_config)
        auth.process_response()
        errors = auth.get_errors()
        if errors:
            error_reason = auth.get_last_error_reason()
            raise IdentityNotValid(error_reason)

        attributes = auth.get_attributes()
        nameid = auth.get_nameid()

        users = []
        options_identifier = 'email'
        if 'options' in provider.config:
            options_identifier = provider.config['options'].get('options_identifier', 'email')

        if options_identifier == 'email':
            email = self.retrieve_email(attributes, nameid, provider.config)
            identifier_value = email

            # Filter users based on the emails provided in the commits
            user_emails = list(
                UserEmail.objects.filter(email__iexact=email, is_verified=True).order_by('id')
            )

            if user_emails:
                users = list(
                    User.objects.filter(
                        id__in=set((ue.user_id for ue in user_emails)),
                        is_active=True,
                        sentry_orgmember_set__organization_id=organization.id
                    )[0:2]
                )
        else:
            username = self.retrieve_username(attributes, provider.config)
            identifier_value = username

            users = list(
                User.objects.filter(
                    username=username,
                    is_active=True,
                    sentry_orgmember_set__organization_id=organization.id
                )[0:2]
            )

        if users:
            if len(users) == 1:
                user = users[0]
                user.backend = settings.AUTHENTICATION_BACKENDS[0]
                if login(
                    request,
                    user,
                    after_2fa=request.build_absolute_uri(),
                    organization_id=organization.id
                ):
                    request.session['saml'] = {
                        'nameid': nameid,
                        'nameid_format': auth.get_nameid_format(),
                        'session_index': auth.get_session_index()
                    }
                return HttpResponseRedirect(get_login_redirect(request))
            else:
                return HttpResponseServerError(
                    "Found several accounts related with %s = %s on this organization" % (options_identifier, identifier_value)
                )
        else:
            options_jit = False
            if 'options' in provider.config:
                options_jit = provider.config['options'].get('options_jit', False)

            if not options_jit:
                return HttpResponseServerError(
                    "The user with %s = %s is not related with this organization" % (options_identifier, identifier_value)
                )
            else:
                return HttpResponseServerError(
                    "Just-in-Time provisioning not implemented yet"
                )

    def retrieve_email(self, attributes, nameid, config, identifier=False):
        email = possible_mail = None
        if nameid and '@' in nameid:
            possible_mail = nameid

        if attributes and 'attribute_mapping' in config and 'attribute_mapping_email' in config[
            'attribute_mapping'
        ]:
            email_mapping = config['attribute_mapping']['attribute_mapping_email']
            if email_mapping and email_mapping in attributes:
                email = attributes[email_mapping][0]
            elif possible_mail:
                email = possible_mail
            elif identifier:
                raise Exception(
                    "Email was not provided by the IdP and is required in order to execute the SAML process"
                )
        elif possible_mail:
            email = possible_mail
        elif identifier:
            raise Exception("Email mapping is required in order to execute the SAML process")
        return email

    def retrieve_username(self, attributes, config, identifier=False):
        username = None
        if attributes and 'attribute_mapping' in config and 'attribute_mapping_username' in config[
            'attribute_mapping'
        ]:
            username_mapping = config['attribute_mapping']['attribute_mapping_username']
            if username_mapping and username_mapping in attributes:
                username = attributes[username_mapping][0]
        elif identifier:
            raise Exception("Username mapping is required in order to execute the SAML process")
        return username

    def retrieve_displayname(self, attributes, config):
        displayname = None
        if attributes and 'attribute_mapping' in config and 'attribute_mapping_displayname' in config[
            'attribute_mapping'
        ]:
            displayname_mapping = config['attribute_mapping']['attribute_mapping_displayname']
            if displayname_mapping and displayname_mapping in attributes:
                displayname = attributes[displayname_mapping][0]
        return displayname


class SAML2SLSView(AuthView):
    def dispatch(self, request, organization_slug):
        provider = get_provider(organization_slug)
        if provider is None:
            raise Http404

        if 'options' not in provider.config or not provider.config['options'].get('options_slo', False):
            raise Exception("SLO is disabled, can't process that action")

        saml_config = provider.build_saml_config(organization_slug)

        auth = provider.build_auth(request, saml_config)
        dscb = lambda: logout(request)
        next = auth.process_slo(delete_session_cb=dscb)
        request.user = AnonymousUser()
        if not next:
            next = get_login_url()

        return self.redirect(next)


class SAML2MetadataView(AuthView):
    def dispatch(self, request, organization_slug):
        provider = get_provider(organization_slug)
        if provider is None:
            raise Http404

        saml_config = provider.build_saml_config(organization_slug)
        saml_settings = OneLogin_Saml2_Settings(settings=saml_config, sp_validation_only=True)
        metadata = saml_settings.get_sp_metadata()
        errors = saml_settings.validate_metadata(metadata)

        if len(errors) == 0:
            resp = HttpResponse(content=metadata, content_type='text/xml')
        else:
            resp = HttpResponseServerError(content=', '.join(errors))
        return resp


class SAML2Provider(Provider):
    def get_auth_pipeline(self):
        return [SAML2LoginView()]

    def build_config(self, state):
        data = {}

        if 'idp' in state.keys():
            data['idp'] = state['idp']

        if 'contact' in state.keys():
            data['contact'] = state['contact']

        return data

    def build_identity(self, state):
        # return None   # TODO  If I return None, then a loop after execute the config
        # happens from organizations/<org>/auth/ to /auth/login/  /<org>/
        identity = {}
        if state and 'contact' in state:
            identity['id'] = state['contact']
            identity['email'] = state['contact']
        return identity

    def build_saml_config(self, org_slug):
        metadata_url = absolute_uri(
            reverse('sentry-auth-organization-saml-metadata', args=[org_slug])
        )
        acs_url = absolute_uri(reverse('sentry-auth-organization-saml-acs', args=[org_slug]))
        sls_url = absolute_uri(reverse('sentry-auth-organization-saml-sls', args=[org_slug]))

        saml_config = {}
        saml_config['strict'] = True
        saml_config['idp'] = self.extract_parsed_data_from_idp_data(self.config)
        saml_config['sp'] = {
            "entityId": metadata_url,
            "assertionConsumerService": {
                "url": acs_url,
                "binding": OneLogin_Saml2_Constants.BINDING_HTTP_POST
            },
            "singleLogoutService": {
                "url": sls_url,
                "binding": OneLogin_Saml2_Constants.BINDING_HTTP_REDIRECT
            }
        }

        saml_config['security'] = self.extract_parsed_data_from_advanced_data(self.config)

        sp_entity_id = saml_config['security'].get('spEntityId', None)
        if sp_entity_id:
            saml_config['sp']['entityId'] = sp_entity_id
            del saml_config['security']['spEntityId']

        sp_x509cert = saml_config['security'].get('spx509cert', None)
        if sp_x509cert:
            saml_config['sp']['x509cert'] = sp_x509cert
            del saml_config['security']['spx509cert']

        sp_private_key = saml_config['security'].get('spPrivateKey', None)
        if sp_private_key:
            saml_config['sp']['privateKey'] = sp_private_key
            del saml_config['security']['spPrivateKey']

        return saml_config

    def prepare_saml_request(self, request):
        url = urlparse(options.get('system.url-prefix'))
        return {
            'https': 'on' if url.scheme == 'https' else 'off',
            'http_host': url.hostname,
            'script_name': request.META['PATH_INFO'],
            'server_port': url.port,
            'get_data': request.GET.copy(),
            'post_data': request.POST.copy()
        }

    def build_auth(self, request, config):
        req = self.prepare_saml_request(request)
        return OneLogin_Saml2_Auth(req, config)

    @staticmethod
    def extract_idp_data_from_form(form):
        idp_data = {
            'idp_entityid': form.cleaned_data.get('idp_entityid', None),
            'idp_sso_url': form.cleaned_data.get('idp_sso_url', None),
            'idp_x509cert': form.cleaned_data.get('idp_x509cert', None),
            'idp_slo_url': form.cleaned_data.get('idp_slo_url', None)
        }
        return idp_data

    @staticmethod
    def extract_options_data_from_form(form):
        options_data = {
            'options_identifier': form.cleaned_data.get('options_identifier', 'email'),
            'options_jit': form.cleaned_data.get('options_jit', False),
            'options_slo': form.cleaned_data.get('options_slo', False)
        }
        return options_data

    @staticmethod
    def extract_attribute_mapping_from_form(form):
        attribute_mapping_data = {
            'attribute_mapping_email': form.cleaned_data.get('attribute_mapping_email', None),
            'attribute_mapping_username': form.cleaned_data.get('attribute_mapping_username', None),
            'attribute_mapping_displayname': form.cleaned_data.get('attribute_mapping_displayname', None)
        }
        return attribute_mapping_data

    @staticmethod
    def extract_advanced_settings_from_form(form):
        advanced_settings_data = {
            'advanced_spentityid': form.cleaned_data.get('advanced_spentityid', None),
            'advanced_nameidformat': form.cleaned_data.get('advanced_nameidformat', OneLogin_Saml2_Constants.NAMEID_UNSPECIFIED),
            'advanced_requestedauthncontext': form.cleaned_data.get('advanced_requestedauthncontext', False),
            'advanced_authn_request_signed': form.cleaned_data.get('advanced_authn_request_signed', False),
            'advanced_logout_request_signed': form.cleaned_data.get('advanced_logout_request_signed', False),
            'advanced_logout_response_signed': form.cleaned_data.get('advanced_logout_response_signed', False),
            'advanced_metadata_signed': form.cleaned_data.get('advanced_metadata_signed', False),
            'advanced_want_message_signed': form.cleaned_data.get('advanced_want_message_signed', False),
            'advanced_want_assertion_signed': form.cleaned_data.get('advanced_want_assertion_signed', False),
            'advanced_want_assertion_encrypted': form.cleaned_data.get('advanced_want_assertion_encrypted', False),
            'advanced_signaturealgorithm': form.cleaned_data.get('advanced_signaturealgorithm', OneLogin_Saml2_Constants.RSA_SHA256),
            'advanced_digestalgorithm': form.cleaned_data.get('advanced_digestalgorithm', OneLogin_Saml2_Constants.SHA256),
            'advanced_sp_x509cert': form.cleaned_data.get('advanced_sp_x509cert', None),
            'advanced_sp_privatekey': form.cleaned_data.get('advanced_sp_privatekey', None),
        }
        return advanced_settings_data

    @staticmethod
    def extract_parsed_data_from_idp_data(data):
        parsed_data = {}
        if 'idp' in data:
            if 'idp_entityid' in data['idp']:
                parsed_data['entityId'] = data['idp']['idp_entityid']
            if 'idp_sso_url' in data['idp']:
                parsed_data['singleSignOnService'] = {}
                parsed_data['singleSignOnService']['url'] = data['idp']['idp_sso_url']
            if 'idp_slo_url' in data['idp']:
                parsed_data['singleLogoutService'] = {}
                parsed_data['singleLogoutService']['url'] = data['idp']['idp_slo_url']
            if 'idp_x509cert' in data['idp']:
                parsed_data['x509cert'] = data['idp']['idp_x509cert']
        return parsed_data

    @staticmethod
    def extract_parsed_data_from_advanced_data(data):
        parsed_data = {}
        if 'advanced_settings' in data:
            parsed_data['spEntityId'] = data['advanced_settings'].get('advanced_spentityid', None)
            parsed_data['NameIDFormat'] = data['advanced_settings'].get('advanced_nameidformat', OneLogin_Saml2_Constants.NAMEID_UNSPECIFIED)
            parsed_data['requestedAuthnContext'] = data['advanced_settings'].get('advanced_requestedauthncontext', False)
            parsed_data['authnRequestsSigned'] = data['advanced_settings'].get('advanced_authn_request_signed', False)
            parsed_data['logoutRequestSigned'] = data['advanced_settings'].get('advanced_logout_request_signed', False)
            parsed_data['logoutResponseSigned'] = data['advanced_settings'].get('advanced_logout_response_signed', False)
            parsed_data['signMetadata'] = data['advanced_settings'].get('advanced_metadata_signed', False)
            parsed_data['wantMessagesSigned'] = data['advanced_settings'].get('advanced_want_message_signed', False)
            parsed_data['wantAssertionsSigned'] = data['advanced_settings'].get('advanced_want_assertion_signed', False)
            parsed_data['wantAssertionsEncrypted'] = data['advanced_settings'].get('advanced_want_assertion_encrypted', False)
            parsed_data['signatureAlgorithm'] = data['advanced_settings'].get('advanced_signaturealgorithm', OneLogin_Saml2_Constants.RSA_SHA256)
            parsed_data['digestAlgorithm'] = data['advanced_settings'].get('advanced_digestalgorithm', OneLogin_Saml2_Constants.SHA256)
            if data['advanced_settings'].get('advanced_sp_x509cert', None):
                parsed_data['spx509cert'] = data['advanced_settings']['advanced_sp_x509cert']
            if data['advanced_settings'].get('advanced_sp_privatekey', None):
                parsed_data['spPrivateKey'] = data['advanced_settings']['advanced_sp_privatekey']
            parsed_data['wantNameId'] = False

        return parsed_data

    def refresh_identity(self, auth_identity):
        # Nothing to refresh
        return

