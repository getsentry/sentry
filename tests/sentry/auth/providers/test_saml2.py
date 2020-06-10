from __future__ import absolute_import, print_function

import pytest
import types

from datetime import datetime
from django.utils import timezone

from sentry.auth.helper import AuthHelper
from sentry.auth.providers.saml2.provider import SAML2Provider, Attributes, SAML2ACSView
from sentry.auth.exceptions import IdentityNotValid
from sentry.models import AuthProvider
from sentry.testutils import TestCase
from sentry.utils.compat import mock

dummy_provider_config = {
    "attribute_mapping": {
        Attributes.IDENTIFIER: "id",
        Attributes.USER_EMAIL: "email",
        Attributes.FIRST_NAME: "first",
        Attributes.LAST_NAME: "last",
    }
}


class SAML2ProviderTest(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        self.auth_provider = AuthProvider.objects.create(provider="saml2", organization=self.org)
        self.provider = SAML2Provider(key=self.auth_provider.provider)
        super(SAML2ProviderTest, self).setUp()

    def test_build_config_adds_attributes(self):
        config = self.provider.build_config({})

        assert "attribute_mapping" in config

    def test_buld_config_with_provider_attributes(self):
        with mock.patch.object(self.provider, "attribute_mapping") as attribute_mapping:
            config = self.provider.build_config({})

            assert "attribute_mapping" in config
            assert config["attribute_mapping"] == attribute_mapping.return_value

    def test_build_identity_invalid(self):
        self.provider.config = dummy_provider_config
        state = {"auth_attributes": {}}

        with pytest.raises(IdentityNotValid):
            self.provider.build_identity(state)

        state = {"auth_attributes": {"id": [""], "email": ["valid@example.com"]}}

        with pytest.raises(IdentityNotValid):
            self.provider.build_identity(state)

        state = {"auth_attributes": {"id": ["1234"], "email": [""]}}

        with pytest.raises(IdentityNotValid):
            self.provider.build_identity(state)

    def test_build_identity(self):
        self.provider.config = dummy_provider_config
        attrs = {
            "id": ["123"],
            "email": ["valid@example.com"],
            "first": ["Morty"],
            "last": ["Smith"],
        }

        state = {"auth_attributes": attrs}
        identity = self.provider.build_identity(state)

        assert identity["id"] == "123"
        assert identity["email"] == "valid@example.com"
        assert identity["name"] == "Morty Smith"


@mock.patch("sentry.auth.providers.saml2.provider.build_auth")
class SAML2ACSViewTest(TestCase):
    def test_set_session_expiration(self, mock_auth):
        self.org = self.create_organization()
        self.auth_provider = AuthProvider.objects.create(provider="saml2", organization=self.org)
        self.provider = SAML2Provider(key=self.auth_provider.provider)
        self.provider.config = dummy_provider_config
        self.auth_provider.get_provider = mock.MagicMock(return_value=self.provider)
        super(SAML2ACSViewTest, self).setUp()

        request = self.make_request(user=None)
        request.META = {
            "PATH_INFO": "/",
        }

        test_view = SAML2ACSView()
        helper = AuthHelper(
            request, self.org, AuthHelper.FLOW_LOGIN, auth_provider=self.auth_provider
        )

        def mock_next_step(self):
            return

        helper.next_step = types.MethodType(mock_next_step, helper)

        instance = mock_auth.return_value
        instance.get_errors.return_value = None
        instance.get_attributes.return_value = {}
        instance.get_session_expiration.return_value = 1591044492

        test_view.dispatch(request, helper)

        assert request.session.get_expiry_date() == datetime.fromtimestamp(1591044492).replace(
            tzinfo=timezone.utc
        )
