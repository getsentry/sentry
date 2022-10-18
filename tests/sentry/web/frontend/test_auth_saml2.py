import base64
from unittest import mock
from urllib.parse import parse_qs, urlencode, urlparse

import pytest
from django.conf import settings
from django.db import models
from django.urls import reverse
from exam import fixture

from sentry import audit_log
from sentry.auth.authenticators import TotpInterface
from sentry.auth.helper import AuthHelperSessionStore
from sentry.auth.providers.saml2.provider import HAS_SAML2, Attributes, SAML2Provider
from sentry.models import AuditLogEntry, AuthProvider, Organization
from sentry.testutils import AuthProviderTestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.silo import control_silo_test

dummy_provider_config = {
    "idp": {
        "entity_id": "https://example.com/saml/metadata/1234",
        "x509cert": "foo_x509_cert",
        "sso_url": "http://example.com/sso_url",
        "slo_url": "http://example.com/slo_url",
    },
    "attribute_mapping": {
        Attributes.IDENTIFIER: "user_id",
        Attributes.USER_EMAIL: "email",
        Attributes.FIRST_NAME: "first_name",
        Attributes.LAST_NAME: "last_name",
    },
}


class DummySAML2Provider(SAML2Provider):
    name = "dummy"

    def get_saml_setup_pipeline(self):
        return []

    def build_config(self, state):
        return dummy_provider_config


@pytest.mark.skipif(not HAS_SAML2, reason="SAML2 library is not installed")
@control_silo_test
class AuthSAML2Test(AuthProviderTestCase):
    provider = DummySAML2Provider
    provider_name = "saml2_dummy"

    def setUp(self):
        self.user = self.create_user("rick@onehundredyears.com")
        self.org = self.create_organization(owner=self.user, name="saml2-org")

        # enable require 2FA and enroll user
        TotpInterface().enroll(self.user)
        self.org.update(flags=models.F("flags").bitor(Organization.flags.require_2fa))
        assert self.org.flags.require_2fa.is_set

        self.auth_provider = AuthProvider.objects.create(
            provider=self.provider_name, config=dummy_provider_config, organization=self.org
        )

        # The system.url-prefix, which is used to generate absolute URLs, must
        # have a TLD for the SAML2 library to consider the URL generated for
        # the ACS endpoint valid.
        self.url_prefix = settings.SENTRY_OPTIONS.get("system.url-prefix")

        settings.SENTRY_OPTIONS.update({"system.url-prefix": "http://testserver.com"})

        super().setUp()

    def tearDown(self):
        # restore url-prefix config
        settings.SENTRY_OPTIONS.update({"system.url-prefix": self.url_prefix})

        super().tearDown()

    @fixture
    def login_path(self):
        return reverse("sentry-auth-organization", args=["saml2-org"])

    @fixture
    def acs_path(self):
        return reverse("sentry-auth-organization-saml-acs", args=["saml2-org"])

    @fixture
    def setup_path(self):
        return reverse("sentry-organization-auth-provider-settings", args=["saml2-org"])

    def test_redirects_to_idp(self):
        resp = self.client.post(self.login_path, {"init": True})

        assert resp.status_code == 302
        redirect = urlparse(resp.get("Location", ""))
        query = parse_qs(redirect.query)

        assert redirect.path == "/sso_url"
        assert "SAMLRequest" in query

    def accept_auth(self, **kargs):
        saml_response = self.load_fixture("saml2_auth_response.xml")
        saml_response = base64.b64encode(saml_response).decode("utf-8")

        # Disable validation of the SAML2 mock response
        is_valid = "onelogin.saml2.response.OneLogin_Saml2_Response.is_valid"

        with mock.patch(is_valid, return_value=True):
            return self.client.post(self.acs_path, {"SAMLResponse": saml_response}, **kargs)

    def test_auth_sp_initiated(self):
        # Start auth process from SP side
        self.client.post(self.login_path, {"init": True})
        auth = self.accept_auth()

        assert auth.status_code == 200
        assert auth.context["existing_user"] == self.user

    def test_auth_idp_initiated(self):
        auth = self.accept_auth()

        assert auth.status_code == 200
        assert auth.context["existing_user"] == self.user

    def test_auth_idp_initiated_invalid_flow_from_session(self):
        original_is_valid = AuthHelperSessionStore.is_valid

        def side_effect(self):
            self.flow = None
            assert original_is_valid(self) is False
            return False

        with mock.patch(
            "sentry.auth.helper.AuthHelperSessionStore.is_valid",
            side_effect=side_effect,
            autospec=True,
        ):
            auth = self.accept_auth()

        assert auth.status_code == 200
        assert auth.context["existing_user"] == self.user

    def test_auth_sp_initiated_invalid_step_index_from_session(self):
        from sentry.auth.helper import AuthHelper

        # Start auth process from SP side
        self.client.post(self.login_path, {"init": True})

        original_get_for_request = AuthHelper.get_for_request

        def side_effect(request):
            helper = original_get_for_request(request)
            # This could occur if redis state has expired
            helper.state.step_index = None
            return helper

        with mock.patch(
            "sentry.auth.helper.AuthHelper.get_for_request",
            side_effect=side_effect,
            autospec=True,
        ):
            response = self.accept_auth()
            assert response.status_code == 302
            assert response["Location"] == "/auth/login/saml2-org/"

    @mock.patch("sentry.auth.helper.logger")
    def test_auth_setup(self, auth_log):
        self.auth_provider.delete()
        self.login_as(self.user)

        data = {"init": True, "provider": self.provider_name}

        with Feature(["organizations:sso-basic", "organizations:sso-saml2"]):
            setup = self.client.post(self.setup_path, data)

        assert setup.status_code == 302
        redirect = urlparse(setup.get("Location", ""))
        assert redirect.path == "/sso_url"

        auth = self.accept_auth(follow=True)

        messages = list(map(lambda m: str(m), auth.context["messages"]))

        assert len(messages) == 2
        assert messages[0] == "You have successfully linked your account to your SSO provider."
        assert messages[1].startswith("SSO has been configured for your organization")

        # require 2FA disabled when saml is enabled
        org = Organization.objects.get(id=self.org.id)
        assert not org.flags.require_2fa.is_set

        event = AuditLogEntry.objects.get(
            target_object=org.id, event=audit_log.get_event_id("ORG_EDIT"), actor=self.user
        )
        audit_log_event = audit_log.get(event.event)
        assert "require_2fa to False when enabling SSO" in audit_log_event.render(event)
        auth_log.info.assert_called_once_with(
            "Require 2fa disabled during sso setup", extra={"organization_id": self.org.id}
        )

    def test_auth_idp_initiated_no_provider(self):
        self.auth_provider.delete()
        auth = self.accept_auth(follow=True)

        assert auth.status_code == 200

        messages = list(map(lambda m: str(m), auth.context["messages"]))
        assert len(messages) == 1
        assert messages[0] == "The organization does not exist or does not have SAML SSO enabled."

    def test_saml_metadata(self):
        path = reverse("sentry-auth-organization-saml-metadata", args=["saml2-org"])
        resp = self.client.get(path)

        assert resp.status_code == 200
        assert resp.get("content-type") == "text/xml"

    def test_logout_request(self):
        saml_request = self.load_fixture("saml2_slo_request.xml")
        saml_request = base64.b64encode(saml_request)

        self.login_as(self.user)

        path = reverse("sentry-auth-organization-saml-sls", args=["saml2-org"])
        path = path + "?" + urlencode({"SAMLRequest": saml_request})
        resp = self.client.get(path)

        assert resp.status_code == 302

        redirect = urlparse(resp.get("Location", ""))
        query = parse_qs(redirect.query)

        assert redirect.path == "/slo_url"
        assert "SAMLResponse" in query

        updated = type(self.user).objects.get(pk=self.user.id)
        assert updated.session_nonce != self.user.session_nonce
