from unittest.mock import patch

from django.urls import reverse

from sentry.api.exceptions import DataSecrecyError
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class DataSecrecyErrorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.owner = self.create_user()
        self.organization = self.create_organization(name="foo", owner=self.owner)
        with assume_test_silo_mode(SiloMode.CELL):
            self.organization.flags.prevent_superuser_access = True
            self.organization.save()

    def test_data_secrecy_renders_for_superuser_access(self) -> None:
        user = self.create_user(is_superuser=True, is_staff=True)
        self.create_identity_provider(type="dummy", external_id="1234")

        self.login_as(user, organization_id=self.organization.id, superuser=True)

        path = reverse("sentry-organization-issue-list", args=[self.organization.slug])
        resp = self.client.get(path)
        assert resp.status_code == 200
        self.assertTemplateUsed("sentry/data-secrecy.html")

    @override_options({"staff.ga-rollout": True})
    def test_data_secrecy_does_not_render_for_staff_access(self) -> None:
        user = self.create_user(is_superuser=True, is_staff=True)
        self.create_identity_provider(type="dummy", external_id="1234")

        self.login_as(user, organization_id=self.organization.id, staff=True)

        path = reverse("sentry-organization-issue-list", args=[self.organization.slug])
        resp = self.client.get(path)

        assert resp.status_code == 200
        self.assertTemplateNotUsed("sentry/data-secrecy.html")

    def test_data_secrecy_does_not_render_for_regular_user(self) -> None:
        user = self.create_user(is_superuser=False, is_staff=False)
        self.create_member(user=user, organization=self.organization)
        self.create_identity_provider(type="dummy", external_id="1234")

        self.login_as(user, organization_id=self.organization.id)

        path = reverse("sentry-organization-issue-list", args=[self.organization.slug])
        resp = self.client.get(path)

        assert resp.status_code == 200
        self.assertTemplateNotUsed("sentry/data-secrecy.html")

    def _get_data_secrecy_page(self) -> bytes:
        user = self.create_user(is_superuser=True, is_staff=True)
        self.login_as(user, organization_id=self.organization.id, superuser=True)

        path = reverse("sentry-organization-issue-list", args=[self.organization.slug])
        with patch(
            "sentry.web.frontend.react_page.ReactPageView.get_access",
            side_effect=DataSecrecyError(),
        ):
            resp = self.client.get(path)
        assert resp.status_code == 403
        return resp.content

    def test_data_secrecy_settings_label(self) -> None:
        content = self._get_data_secrecy_page()
        assert b"Organization Settings -> Security & Privacy" in content

    def test_data_secrecy_settings_label_with_settings_v3(self) -> None:
        with self.feature("organizations:settings-v3"):
            content = self._get_data_secrecy_page()
        assert b"Org Settings -> Security & Privacy" in content
