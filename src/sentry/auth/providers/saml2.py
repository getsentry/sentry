from __future__ import absolute_import, print_function

from django import forms
from django.conf import settings
from django.core.urlresolvers import reverse
from django.contrib import messages
from django.contrib.auth import logout
from django.http import (
    HttpResponse, HttpResponseRedirect, HttpResponseServerError, HttpResponseNotAllowed,
)
from django.utils.decorators import method_decorator
from django.utils.translation import ugettext_lazy as _
from django.views.decorators.csrf import csrf_exempt
from six.moves.urllib.parse import urlparse
from six import add_metaclass

from sentry import options
from sentry.auth import Provider, AuthView
from sentry.auth.view import ConfigureView
from sentry.models import (AuthProvider, Organization, OrganizationStatus, User, UserEmail)
from sentry.utils.http import absolute_uri
from sentry.utils.auth import login, get_login_redirect, get_login_url
from sentry.web.frontend.base import BaseView

try:
    from onelogin.saml2.auth import OneLogin_Saml2_Auth, OneLogin_Saml2_Settings
    from onelogin.saml2.constants import OneLogin_Saml2_Constants
    HAS_SAML2 = True
except ImportError:
    HAS_SAML2 = False

    def OneLogin_Saml2_Auth(*args, **kwargs):
        raise NotImplementedError('Missing SAML libraries')

    def OneLogin_Saml2_Settings(*args, **kwargs):
        raise NotImplementedError('Missing SAML libraries')

    class NoopGetter(type):
        def __getattr__(self, key):
            return None

    @add_metaclass(NoopGetter)
    class OneLogin_Saml2_Constants(object):
        pass


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

ERR_NO_SAML_SSO = _('The organization does not exist or does not have SAML SSO enabled.')


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


class OptionsForm(forms.Form):
    options_jit = forms.BooleanField(
        label="Just-in-time Provisioning",
        required=False,
        help_text=_('Enable/disable Auto-provisioning. If user not exists, '
                    'Sentry will create a new user account with the data '
                    'provided by the IdP when they first login.')
    )

    def clean(self):
        super(OptionsForm, self).clean()

        invalid_jit = (
            self.data.get('options_jit', None) and
            not (
                self.data.get('attribute_mapping_email', None) and
                self.data.get('attribute_mapping_displayname', None)
            )
        )

        if invalid_jit:
            del self.cleaned_data["options_jit"]
            self._errors["options_jit"] = [
                _("JIT enabled but required attribute mapping not provided")
            ]

        return self.cleaned_data


class AttributeMappingForm(forms.Form):
    attribute_mapping_email = forms.CharField(label='Email', required=False)
    attribute_mapping_displayname = forms.CharField(label='Display Name', required=False)


class SAML2ConfigureView(ConfigureView):
    saml_form_cls = None
    advanced_form_cls = None

    def dispatch(self, request, organization, auth_provider):
        if self.saml_form_cls is None or self.advanced_form_cls is None:
            raise NotImplementedError('Custom forms must be defined by the extended class')

        if request.method == 'POST':
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
                attribute_mapping_data = SAML2Provider.extract_attribute_mapping_from_form(
                    attr_mapping_form
                )
                auth_provider.config['attribute_mapping'] = attribute_mapping_data
                valid_forms += 1
            if advanced_form.is_valid():
                advanced_settings_data = SAML2Provider.extract_advanced_settings_from_form(
                    advanced_form
                )
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

        return self.display_configure_view(
            organization,
            saml_form,
            options_form,
            attr_mapping_form,
            advanced_form
        )

    def display_configure_view(self, organization, saml_form, options_form,
                               attr_mapping_form, advanced_form):
        raise NotImplementedError('Display Configure View not implemented!')


class SAML2LoginView(AuthView):
    def dispatch(self, request, helper):
        provider = helper.provider
        if provider is None:
            messages.add_message(request, messages.ERROR, ERR_NO_SAML_SSO)
            return HttpResponseRedirect(request.path)

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
            messages.add_message(request, messages.ERROR, ERR_NO_SAML_SSO)
            return HttpResponseRedirect('/')

        organization = Organization.objects.get(slug=organization_slug)
        saml_config = provider.build_saml_config(organization_slug)

        auth = provider.build_auth(request, saml_config)
        auth.process_response()

        # SSO response verification failed
        errors = auth.get_errors()
        if errors:
            message = _('SAML SSO failed: {reason}').format(reason=auth.get_last_error_reason())
            messages.add_message(request, messages.ERROR, message)

            return HttpResponseRedirect(get_login_url())

        attributes = auth.get_attributes()
        nameid = auth.get_nameid()

        email = self.retrieve_email(attributes, nameid, provider.config)
        user_emails = list(
            UserEmail.objects.filter(email__iexact=email, is_verified=True).order_by('id')
        )

        users = []
        if user_emails:
            users = User.objects.filter(
                id__in=set((ue.user_id for ue in user_emails)),
                is_active=True,
                sentry_orgmember_set__organization_id=organization.id
            )
            users = list(users[0:2])

        if not users:
            options_jit = provider.config.get('options', {}).get('options_jit', False)

            if not options_jit:
                message = "The user with a verified email %s does not exist" % email
                return HttpResponseServerError(message)
            else:
                return HttpResponseServerError("Just-in-Time provisioning not implemented yet")

        if len(users) > 1:
            return HttpResponseServerError(
                "Found several accounts related with %s on this organization" % email)

        user = users[0]
        user.backend = settings.AUTHENTICATION_BACKENDS[0]

        login_resp = login(
            request,
            user,
            after_2fa=request.build_absolute_uri(),
            organization_id=organization.id
        )

        if login_resp:
            request.session['saml'] = {
                'nameid': nameid,
                'nameid_format': auth.get_nameid_format(),
                'session_index': auth.get_session_index()
            }

        return HttpResponseRedirect(get_login_redirect(request))

    def retrieve_email(self, attributes, nameid, config):
        possible_email = None
        if nameid and '@' in nameid:
            possible_email = nameid

        email_key = config.get('attribute_mapping', {}).get('attribute_mapping_email', None)

        if attributes and email_key in attributes:
            return attributes[email_key][0]

        if possible_email:
            return possible_email

        raise Exception('Cannot retrieve email from attributes')

    def retrieve_displayname(self, attributes, config):
        name_key = config.get('attribute_mapping', {}).get('attribute_mapping_displayname', None)

        if attributes and name_key in attributes:
            return attributes[name_key][0]

        return None


class SAML2SLSView(BaseView):
    def dispatch(self, request, organization_slug):
        provider = get_provider(organization_slug)
        if provider is None:
            messages.add_message(request, messages.ERROR, ERR_NO_SAML_SSO)
            return HttpResponseRedirect('/')

        saml_config = provider.build_saml_config(organization_slug)
        auth = provider.build_auth(request, saml_config)

        def force_logout():
            request.user.refresh_session_nonce()
            request.user.save()
            logout(request)

        redirect_to = auth.process_slo(delete_session_cb=force_logout)
        if not redirect_to:
            redirect_to = get_login_url()

        return self.redirect(redirect_to)


class SAML2MetadataView(BaseView):
    def dispatch(self, request, organization_slug):
        provider = get_provider(organization_slug)
        if provider is None:
            messages.add_message(request, messages.ERROR, ERR_NO_SAML_SSO)
            return HttpResponseRedirect('/')

        saml_config = provider.build_saml_config(organization_slug)
        saml_settings = OneLogin_Saml2_Settings(settings=saml_config, sp_validation_only=True)
        metadata = saml_settings.get_sp_metadata()
        errors = saml_settings.validate_metadata(metadata)

        if len(errors) > 0:
            message = '\n'.join(errors)
            return HttpResponseServerError(content=message, content_type='plain/text')

        return HttpResponse(content=metadata, content_type='text/xml')


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

    def refresh_identity(self, auth_identity):
        # Nothing to refresh
        return

    @staticmethod
    def extract_idp_data_from_parsed_data(data):
        idp_data = {}
        if 'entityId' in data['idp']:
            idp_data['idp_entityid'] = data['idp']['entityId']
        if 'singleSignOnService' in data['idp'] and 'url' in data['idp']['singleSignOnService']:
            idp_data['idp_sso_url'] = data['idp']['singleSignOnService']['url']
        if 'singleLogoutService' in data['idp'] and 'url' in data['idp']['singleLogoutService']:
            idp_data['idp_slo_url'] = data['idp']['singleLogoutService']['url']
        if 'x509cert' in data['idp']:
            idp_data['idp_x509cert'] = data['idp']['x509cert']
        return idp_data

    @staticmethod
    def extract_idp_data_from_form(form):
        d = form.cleaned_data

        return {
            'idp_entityid': d.get('idp_entityid', None),
            'idp_sso_url': d.get('idp_sso_url', None),
            'idp_x509cert': d.get('idp_x509cert', None),
            'idp_slo_url': d.get('idp_slo_url', None)
        }

    @staticmethod
    def extract_options_data_from_form(form):
        d = form.cleaned_data

        return {
            'options_jit': d.get('options_jit', False),
        }

    @staticmethod
    def extract_attribute_mapping_from_form(form):
        d = form.cleaned_data

        return {
            'attribute_mapping_email': d.get('attribute_mapping_email', None),
            'attribute_mapping_displayname': d.get('attribute_mapping_displayname', None)
        }

    @staticmethod
    def extract_advanced_settings_from_form(form):
        d = form.cleaned_data

        return {
            'advanced_spentityid': d.get('advanced_spentityid', None),
            'advanced_nameidformat': d.get('advanced_nameidformat', OneLogin_Saml2_Constants.NAMEID_UNSPECIFIED),
            'advanced_requestedauthncontext': d.get('advanced_requestedauthncontext', False),
            'advanced_authn_request_signed': d.get('advanced_authn_request_signed', False),
            'advanced_logout_request_signed': d.get('advanced_logout_request_signed', False),
            'advanced_logout_response_signed': d.get('advanced_logout_response_signed', False),
            'advanced_metadata_signed': d.get('advanced_metadata_signed', False),
            'advanced_want_message_signed': d.get('advanced_want_message_signed', False),
            'advanced_want_assertion_signed': d.get('advanced_want_assertion_signed', False),
            'advanced_want_assertion_encrypted': d.get('advanced_want_assertion_encrypted', False),
            'advanced_signaturealgorithm': d.get('advanced_signaturealgorithm', OneLogin_Saml2_Constants.RSA_SHA256),
            'advanced_digestalgorithm': d.get('advanced_digestalgorithm', OneLogin_Saml2_Constants.SHA256),
            'advanced_sp_x509cert': d.get('advanced_sp_x509cert', None),
            'advanced_sp_privatekey': d.get('advanced_sp_privatekey', None),
        }

    @staticmethod
    def extract_parsed_data_from_idp_data(data):
        if 'idp' not in data:
            return {}

        parsed_data = {}

        if 'idp_entityid' in data['idp']:
            parsed_data['entityId'] = data['idp']['idp_entityid']
        if 'idp_sso_url' in data['idp']:
            parsed_data['singleSignOnService'] = {'url': data['idp']['idp_sso_url']}
        if 'idp_slo_url' in data['idp']:
            parsed_data['singleLogoutService'] = {'url': data['idp']['idp_slo_url']}
        if 'idp_x509cert' in data['idp']:
            parsed_data['x509cert'] = data['idp']['idp_x509cert']

        return parsed_data

    @staticmethod
    def extract_parsed_data_from_advanced_data(data):
        if 'advanced_settings' not in data:
            return {}

        d = data['advanced_settings']

        parsed_data = {
            'spEntityId': d.get('advanced_spentityid', None),
            'NameIDFormat': d.get('advanced_nameidformat', OneLogin_Saml2_Constants.NAMEID_UNSPECIFIED),
            'requestedAuthnContext': d.get('advanced_requestedauthncontext', False),
            'authnRequestsSigned': d.get('advanced_authn_request_signed', False),
            'logoutRequestSigned': d.get('advanced_logout_request_signed', False),
            'logoutResponseSigned': d.get('advanced_logout_response_signed', False),
            'signMetadata': d.get('advanced_metadata_signed', False),
            'wantMessagesSigned': d.get('advanced_want_message_signed', False),
            'wantAssertionsSigned': d.get('advanced_want_assertion_signed', False),
            'wantAssertionsEncrypted': d.get('advanced_want_assertion_encrypted', False),
            'signatureAlgorithm': d.get('advanced_signaturealgorithm', OneLogin_Saml2_Constants.RSA_SHA256),
            'digestAlgorithm': d.get('advanced_digestalgorithm', OneLogin_Saml2_Constants.SHA256),
            'wantNameId': False,
        }

        if d.get('advanced_sp_x509cert', None):
            parsed_data['spx509cert'] = d['advanced_sp_x509cert']
        if d.get('advanced_sp_privatekey', None):
            parsed_data['spPrivateKey'] = d['advanced_sp_privatekey']

        return parsed_data
