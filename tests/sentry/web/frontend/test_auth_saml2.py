from __future__ import absolute_import

import base64
import mock
from exam import fixture
from six.moves.urllib.parse import urlencode, urlparse, parse_qs

from django.conf import settings
from django.core.urlresolvers import reverse

from sentry.auth.providers.saml2 import SAML2Provider, Attributes
from sentry.models import AuthProvider
from sentry.testutils import AuthProviderTestCase


dummy_provider_config = {
    'idp': {
        'entity_id': 'https://example.com/saml/metadata/1234',
        'x509cert': 'foo_x509_cert',
        'sso_url': 'http://example.com/sso_url',
        'slo_url': 'http://example.com/slo_url',
    },
    'attribute_mapping': {
        Attributes.IDENTIFIER: 'user_id',
        Attributes.USER_EMAIL: 'email',
        Attributes.FIRST_NAME: 'first_name',
        Attributes.LAST_NAME: 'last_name',
    },
}


class DummySAML2Provider(SAML2Provider):
    strict_mode = False

    def get_saml_setup_pipeline(self):
        return []


class AuthSAML2Test(AuthProviderTestCase):
    provider = DummySAML2Provider
    provider_name = 'saml2_dummy'

    def setUp(self):
        self.user = self.create_user('rick@onehundredyears.com')
        self.org = self.create_organization(owner=self.user, name='saml2-org')
        self.auth_provider = AuthProvider.objects.create(
            provider=self.provider_name,
            config=dummy_provider_config,
            organization=self.org,
        )

        # The system.url-prefix, which is used to generate absolute URLs, must
        # have a TLD for the SAML2 library to consider the URL generated for
        # the ACS endpoint valid.
        self.url_prefix = settings.SENTRY_OPTIONS.get('system.url-prefix')

        settings.SENTRY_OPTIONS.update({
            'system.url-prefix': 'http://testserver.com',
        })

        super(AuthSAML2Test, self).setUp()

    def tearDown(self):
        # restore url-prefix config
        settings.SENTRY_OPTIONS.update({
            'system.url-prefix': self.url_prefix,
        })

        super(AuthSAML2Test, self).tearDown()

    @fixture
    def login_path(self):
        return reverse('sentry-auth-organization', args=['saml2-org'])

    @fixture
    def sso_path(self):
        return reverse('sentry-auth-sso')

    def test_redirects_to_idp(self):
        resp = self.client.post(self.login_path, {'init': True})

        assert resp.status_code == 302
        redirect = urlparse(resp.get('Location', ''))
        query = parse_qs(redirect.query)

        assert redirect.path == '/sso_url'
        assert 'SAMLRequest' in query

    def test_auth_from_idp(self):
        # Start auth process
        self.client.post(self.login_path, {'init': True})

        saml_response = self.load_fixture('saml2_auth_response.xml')
        saml_response = base64.b64encode(saml_response)

        # Disable validation of the SAML2 mock response
        is_valid = 'onelogin.saml2.response.OneLogin_Saml2_Response.is_valid'

        with mock.patch(is_valid, return_value=True):
            resp = self.client.post(self.sso_path, {'SAMLResponse': saml_response})

        assert resp.status_code == 200
        assert resp.context['existing_user'] == self.user

    def test_saml_metadata(self):
        path = reverse('sentry-auth-organization-saml-metadata', args=['saml2-org'])
        resp = self.client.get(path)

        assert resp.status_code == 200
        assert resp.get('content-type') == 'text/xml'

    def test_logout_request(self):
        saml_request = self.load_fixture('saml2_slo_request.xml')
        saml_request = base64.b64encode(saml_request)

        self.login_as(self.user)

        path = reverse('sentry-auth-organization-saml-sls', args=['saml2-org'])
        path = path + '?' + urlencode({'SAMLRequest': saml_request})
        resp = self.client.get(path)

        assert resp.status_code == 302

        redirect = urlparse(resp.get('Location', ''))
        query = parse_qs(redirect.query)

        assert redirect.path == '/slo_url'
        assert 'SAMLResponse' in query
