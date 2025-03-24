import base64
import contextlib
from functools import cached_property
from unittest import mock
from urllib.parse import parse_qs, urlencode, urlparse

from django.conf import settings
from django.db import models
from django.urls import reverse

from sentry import audit_log
from sentry.auth.authenticators.totp import TotpInterface
from sentry.auth.helper import AuthHelperSessionStore
from sentry.auth.providers.saml2.generic.provider import GenericSAML2Provider
from sentry.auth.providers.saml2.provider import Attributes
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.authidentity import AuthIdentity
from sentry.models.authprovider import AuthProvider
from sentry.models.organization import Organization
from sentry.silo.base import SiloMode
from sentry.testutils.cases import AuthProviderTestCase
from sentry.testutils.helpers import Feature
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test

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


class DummySAML2Provider(GenericSAML2Provider):
    name = "dummy"
    key = "saml2_dummy"

    def get_saml_setup_pipeline(self):
        return []

    def build_config(self, state):
        return dummy_provider_config


@control_silo_test
class AuthSAML2Test(AuthProviderTestCase):
    provider = DummySAML2Provider
    provider_name = "saml2_dummy"

    def setUp(self):
        self.user = self.create_user("rick@onehundredyears.com")
        self.organization = self.create_organization(owner=self.user, name="saml2-org")
        self.auth_provider_inst = AuthProvider.objects.create(
            provider=self.provider_name,
            config=dummy_provider_config,
            organization_id=self.organization.id,
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

    @cached_property
    def login_path(self):
        return reverse("sentry-auth-organization", args=["saml2-org"])

    @cached_property
    def acs_path(self):
        return reverse("sentry-auth-organization-saml-acs", args=["saml2-org"])

    @cached_property
    def setup_path(self):
        return reverse("sentry-organization-auth-provider-settings", args=["saml2-org"])

    def test_redirects_to_idp(self):
        resp = self.client.post(self.login_path, {"init": True})

        assert resp.status_code == 302
        redirect = urlparse(resp.get("Location", ""))
        query = parse_qs(redirect.query)

        assert redirect.path == "/sso_url"
        assert "SAMLRequest" in query

    def accept_auth(self, follow=False, **kwargs):
        saml_response = self.load_fixture("saml2_auth_response.xml")
        saml_response = base64.b64encode(saml_response).decode("utf-8")

        # Disable validation of the SAML2 mock response
        is_valid = "onelogin.saml2.response.OneLogin_Saml2_Response.is_valid"

        with mock.patch(is_valid, return_value=True), contextlib.ExitStack() as stack:
            if follow:
                stack.enter_context(self.auto_select_silo_mode_on_redirects())
            return self.client.post(
                self.acs_path, {"SAMLResponse": saml_response}, follow=follow, **kwargs
            )

    def test_auth_sp_initiated(self):
        # Start auth process from SP side
        self.client.post(self.login_path, {"init": True})
        auth = self.accept_auth()

        assert auth.status_code == 200
        assert auth.context["existing_user"] == self.user

    def test_auth_sp_initiated_login(self):
        # setup an existing identity so we can complete login
        AuthIdentity.objects.create(
            user_id=self.user.id, auth_provider=self.auth_provider_inst, ident="1234"
        )
        self.client.post(self.login_path, {"init": True})

        resp = self.accept_auth(follow=True)

        assert resp.status_code == 200
        assert resp.redirect_chain == [
            ("/auth/login/", 302),
            ("/organizations/saml2-org/issues/", 302),
        ]

    def test_auth_sp_initiated_customer_domain(self):
        # setup an existing identity so we can complete login
        AuthIdentity.objects.create(
            user_id=self.user.id, auth_provider=self.auth_provider_inst, ident="1234"
        )
        self.client.post(self.login_path, {"init": True}, HTTP_HOST="saml2-org.testserver")

        resp = self.accept_auth(follow=True)

        assert resp.status_code == 200
        assert resp.redirect_chain == [
            ("http://saml2-org.testserver/auth/login/", 302),
            ("http://saml2-org.testserver/issues/", 302),
        ]

    @with_feature("system:multi-region")
    def test_auth_sp_initiated_login_customer_domain_feature(self):
        # setup an existing identity so we can complete login
        AuthIdentity.objects.create(
            user_id=self.user.id, auth_provider=self.auth_provider_inst, ident="1234"
        )
        self.client.post(self.login_path, {"init": True})

        resp = self.accept_auth(follow=True)

        assert resp.status_code == 200
        assert resp.redirect_chain == [
            ("http://saml2-org.testserver/auth/login/", 302),
            ("http://saml2-org.testserver/issues/", 302),
        ]

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
            assert helper is not None
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
        # enable require 2FA and enroll user
        TotpInterface().enroll(self.user)
        with assume_test_silo_mode(SiloMode.REGION):
            self.organization.update(flags=models.F("flags").bitor(Organization.flags.require_2fa))
        assert self.organization.flags.require_2fa.is_set

        self.auth_provider_inst.delete()
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
        with assume_test_silo_mode(SiloMode.REGION):
            org = Organization.objects.get(id=self.organization.id)
            assert not org.flags.require_2fa

        event = AuditLogEntry.objects.get(
            target_object=org.id, event=audit_log.get_event_id("ORG_EDIT"), actor=self.user
        )
        audit_log_event = audit_log.get(event.event)
        assert "require_2fa to False when enabling SSO" in audit_log_event.render(event)
        auth_log.info.assert_called_once_with(
            "Require 2fa disabled during sso setup", extra={"organization_id": self.organization.id}
        )

    def test_auth_idp_initiated_no_provider(self):
        self.auth_provider_inst.delete()
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

    def test_verify_email(self, follow=False, **kwargs):
        assert AuthIdentity.objects.filter(user_id=self.user.id).count() == 0

        response = self.accept_auth()
        assert response.status_code == 200

        response = self.client.post(self.acs_path, {"op": "confirm"})

        # expect no linking before verification
        assert AuthIdentity.objects.filter(user_id=self.user.id).count() == 0
