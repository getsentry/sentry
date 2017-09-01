from __future__ import absolute_import, print_function

from django.conf import settings
from django.core.urlresolvers import reverse
from django.http import (
    HttpResponse, HttpResponseRedirect, HttpResponseServerError,
    HttpResponseNotAllowed, Http404,
)
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from six.moves.urllib.parse import urlparse

from sentry import options
from sentry.auth import Provider, AuthView
from sentry.auth.exceptions import IdentityNotValid
from sentry.models import (AuthProvider, Organization, OrganizationStatus, User, UserEmail)
from sentry.utils.http import absolute_uri
from sentry.utils.auth import login, get_login_redirect

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


class SAML2LoginView(AuthView):
    def dispatch(self, request, helper):
        provider = helper.provider
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

        email = self.retrieve_email(attributes, nameid, provider.config)

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
                        "Found several accounts related with %s on this organization" % email
                    )
            else:
                return HttpResponseServerError(
                    "The user %s is not related with this organization" % email
                )
        else:
            return HttpResponseServerError(
                "An user with a verified mail: %s does not exist" % email
            )

    def retrieve_email(self, attributes, nameid, config):
        possible_mail = None
        if nameid and '@' in nameid:
            possible_mail = nameid

        if attributes and 'attribute_mapping' in config and 'attribute_mapping_email' in config[
            'attribute_mapping'
        ]:
            email_mapping = config['attribute_mapping']['attribute_mapping_email']
            if email_mapping and email_mapping in attributes:
                return attributes[email_mapping][0]
            elif possible_mail:
                return possible_mail
            else:
                raise Exception(
                    "Email was not provided by the IdP and is required in order to execute the SAML process"
                )
        elif possible_mail:
            return possible_mail
        else:
            raise Exception("Email mapping is required in order to execute the SAML process")

    def retrieve_firstname(self, attributes, config):
        firstname = None
        if attributes and 'attribute_mapping' in config and 'attribute_mapping_firstname' in config[
            'attribute_mapping'
        ]:
            firstname_mapping = config['attribute_mapping']['attribute_mapping_firstname']
            if firstname_mapping and firstname_mapping in attributes:
                firstname = attributes[firstname_mapping][0]
        return firstname


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

        if data:
            data['attribute_mapping'] = {
                'attribute_mapping_email': 'email',
                'attribute_mapping_firstname': ''
            }
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

        saml_config = {}
        saml_config['strict'] = True
        saml_config['idp'] = self.extract_parsed_data_from_idp_data(self.config)
        saml_config['sp'] = {
            "entityId": metadata_url,
            "assertionConsumerService": {
                "url": acs_url,
                "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
            }
        }
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
            'idp_entityid': form.cleaned_data['idp_entityid'],
            'idp_sso_url': form.cleaned_data['idp_sso_url'],
            'idp_x509cert': form.cleaned_data['idp_x509cert']
        }
        if form.cleaned_data['idp_slo_url']:
            idp_data['idp_slo_url'] = form.cleaned_data['idp_slo_url']
        return idp_data

    @staticmethod
    def extract_attribute_mapping_from_form(form):
        mapping_data = {
            'attribute_mapping_email': form.cleaned_data['attribute_mapping_email'],
            'attribute_mapping_firstname': form.cleaned_data['attribute_mapping_firstname']
        }
        return mapping_data

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

    def refresh_identity(self, auth_identity):
        # Nothing to refresh
        return
