from __future__ import absolute_import, print_function

import pytest
import mock

from sentry.auth.providers.saml2 import SAML2Provider, Attributes

from sentry.auth.exceptions import IdentityNotValid
from sentry.models import AuthProvider
from sentry.testutils import TestCase

dummy_provider_config = {
    'attribute_mapping': {
        Attributes.IDENTIFIER: 'id',
        Attributes.USER_EMAIL: 'email',
        Attributes.FIRST_NAME: 'first',
        Attributes.LAST_NAME: 'last',
    }
}


class SAML2ProviderTest(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        self.auth_provider = AuthProvider.objects.create(
            provider='saml2',
            organization=self.org,
        )
        self.provider = SAML2Provider(key=self.auth_provider.provider)
        super(SAML2ProviderTest, self).setUp()

    def test_build_config_adds_attributes(self):
        config = self.provider.build_config({})

        assert 'attribute_mapping' in config

    def test_buld_config_with_provider_attributes(self):
        with mock.patch.object(self.provider, 'attribute_mapping') as attribute_mapping:
            config = self.provider.build_config({})

            assert 'attribute_mapping' in config
            assert config['attribute_mapping'] == attribute_mapping.return_value

    def test_build_identity_invalid(self):
        self.provider.config = dummy_provider_config
        state = {'auth_attributes': {}}

        with pytest.raises(IdentityNotValid):
            self.provider.build_identity(state)

        state = {'auth_attributes': {'id': [''], 'email': ['valid@example.com']}}

        with pytest.raises(IdentityNotValid):
            self.provider.build_identity(state)

        state = {'auth_attributes': {'id': ['1234'], 'email': ['']}}

        with pytest.raises(IdentityNotValid):
            self.provider.build_identity(state)

    def test_build_identity(self):
        self.provider.config = dummy_provider_config
        attrs = {
            'id': ['123'],
            'email': ['valid@example.com'],
            'first': ['Morty'],
            'last': ['Smith'],
        }

        state = {'auth_attributes': attrs}
        identity = self.provider.build_identity(state)

        assert identity['id'] == '123'
        assert identity['email'] == 'valid@example.com'
        assert identity['name'] == 'Morty Smith'
