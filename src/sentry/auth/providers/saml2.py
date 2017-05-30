from __future__ import absolute_import, print_function

from django.http import HttpResponse, HttpResponseServerError
from django.core.urlresolvers import reverse

from onelogin.saml2.auth import OneLogin_Saml2_Auth, OneLogin_Saml2_Settings

from sentry.auth import Provider, AuthView
from sentry.models import AuthProvider, Organization, OrganizationStatus
from sentry.utils.http import absolute_uri


class SAML2LoginView(AuthView):
    def dispatch(self, request, helper):
        if 'SAMLResponse' in request.POST.keys():
            return helper.next_step()
        saml_config = helper.provider.build_saml_config(helper.organization.slug)
        auth = helper.provider.build_auth(request, saml_config)
        return self.redirect(auth.login())


class SAML2ACSView(AuthView):
    def dispatch(self, request, helper):
        saml_config = helper.provider.build_saml_config(helper.organization.slug)
        auth = helper.provider.build_auth(request, saml_config)
        auth.process_response()
        errors = auth.get_errors()
        if errors:
            error_reason = auth.get_last_error_reason()
            raise IdentityNotValid(error_reason)

        data = {
            'attributes': auth.get_attributes(),
            'nameid': auth.get_nameid(),
            'session_index': auth.get_session_index()
        }

        helper.bind_state('data', data)
        return helper.next_step()
        #return HttpResponse("ACS endpoint")


class SAML2MetadataView(AuthView):
    def dispatch(self, request, organization_slug):
        try:
            organization = Organization.objects.get(
                slug=organization_slug
            )
        except Organization.DoesNotExist:
            return self.redirect(reverse('sentry-login'))

        if organization.status != OrganizationStatus.VISIBLE:
            return self.redirect(reverse('sentry-login'))

        try:
            auth_provider = AuthProvider.objects.get(
                organization=organization
            )
        except AuthProvider.DoesNotExist:
            return self.redirect(reverse('sentry-login'))

        saml_config = auth_provider.get_provider().build_saml_config(organization_slug)
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
        return [
            SAML2LoginView(),
            SAML2ACSView()
        ]

    def build_config(self, state):
        data = {}
        if 'idp' in state.keys():
            data['idp'] = state['idp']
        if 'contact' in state.keys():
            data['contact'] = state['contact']
        return data

    def build_saml_config(self, org_slug):
        #metadata_url = absolute_uri(reverse('sentry-auth-organization-saml-metadata', args=[org_slug]))
        #acs_url = absolute_uri(reverse('sentry-auth-organization-saml-acs', args=[org_slug]))
        metadata_url = acs_url = absolute_uri(reverse('sentry-auth-organization', args=[org_slug]))

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
        return {
            'http_host': request.META['HTTP_HOST'],
            'script_name': request.META['PATH_INFO'],
            'server_port': request.META['SERVER_PORT'],
            'get_data': request.GET.copy(),
            'post_data': request.POST.copy()
        }

    def build_auth(self, request, config):
        req = self.prepare_saml_request(request)
        return OneLogin_Saml2_Auth(req, config)

    def get_saml_data(self, payload):
        data = {}
        if 'session_index' in payload and payload['session_index']:
            data['session_index'] = payload['session_index']
        return data

    def build_identity(self, state):
        identity = {}
        # On setup we don't have the saml identity, but let's use the one stored
        # in the contact, that is the logged user
        # that will allow admin to sso, but what happen with the rest?
        if state and 'contact' in state:
            identity['id'] = state['contact']
            identity['email'] = state['contact']
        elif state and 'data' in state and 'attributes' in state['data']:
            data = state['data']
            # TODO apply attribute mapping
            identity['id'] = data['attributes']['User.email'][0]
            identity['email'] = data['attributes']['User.email'][0]
            identity['name'] = data['attributes']['User.FirstName'][0]
            identity['data'] = self.get_saml_data(data)
        return identity

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
