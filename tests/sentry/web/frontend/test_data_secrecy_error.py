from unittest.mock import patch

from django.urls import reverse

from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


@control_silo_test
class DataSecrecyErrorTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.owner = self.create_user()
        self.organization = self.create_organization(name="foo", owner=self.owner)
        with assume_test_silo_mode(SiloMode.REGION):
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


@control_silo_test
class DataSecrecyImpersonationViewTest(TestCase):
    """Tests for data secrecy handling during superuser impersonation.

    When superuser A impersonates superuser B on a data-secrecy org,
    active_organization may be None (B's superuser session UID doesn't match A's).
    These tests verify that the view correctly raises DataSecrecyError
    instead of entering an auth redirect loop.
    """

    def setUp(self) -> None:
        super().setUp()
        self.owner = self.create_user()
        self.organization = self.create_organization(name="victim-org", owner=self.owner)
        with assume_test_silo_mode(SiloMode.REGION):
            self.organization.flags.prevent_superuser_access = True
            self.organization.save()

        # Superuser A: the one who activated the superuser session
        self.superuser_a = self.create_user(is_superuser=True, is_staff=True)
        # Superuser B: the one being impersonated
        self.superuser_b = self.create_user(is_superuser=True, is_staff=True)

    @with_feature("organizations:data-secrecy")
    def test_impersonating_different_superuser_renders_data_secrecy(self) -> None:
        """Superuser A impersonates superuser B on a data-secrecy org.

        B is not a member of the org and B's superuser session is not active
        (UID mismatch), so active_organization is None. The view should render
        data-secrecy.html instead of entering a redirect loop.
        """
        self.login_as(self.superuser_b, organization_id=self.organization.id, superuser=False)

        path = reverse("sentry-organization-issue-list", args=[self.organization.slug])

        from sentry.web.frontend.react_page import ReactPageView

        original_dispatch = ReactPageView.dispatch

        def patched_dispatch(self_view, request, *args, **kwargs):
            request.actual_user = self.superuser_a
            return original_dispatch(self_view, request, *args, **kwargs)

        with (
            self.settings(SENTRY_SELF_HOSTED=False),
            patch.object(ReactPageView, "dispatch", patched_dispatch),
        ):
            resp = self.client.get(path)

        assert resp.status_code == 403
        self.assertTemplateUsed("sentry/data-secrecy.html")

    @with_feature("organizations:data-secrecy")
    def test_impersonating_member_on_data_secrecy_org_renders_data_secrecy(self) -> None:
        """Superuser A impersonates a regular member of the data-secrecy org."""
        member_user = self.create_user()
        self.create_member(user=member_user, organization=self.organization)
        self.login_as(member_user, organization_id=self.organization.id)

        from sentry.web.frontend.react_page import ReactPageView

        original_dispatch = ReactPageView.dispatch

        def patched_dispatch(self_view, request, *args, **kwargs):
            request.actual_user = self.superuser_a
            return original_dispatch(self_view, request, *args, **kwargs)

        path = reverse("sentry-organization-issue-list", args=[self.organization.slug])
        with (
            self.settings(SENTRY_SELF_HOSTED=False),
            patch.object(ReactPageView, "dispatch", patched_dispatch),
        ):
            resp = self.client.get(path)

        assert resp.status_code == 403
        self.assertTemplateUsed("sentry/data-secrecy.html")

    @with_feature("organizations:data-secrecy")
    def test_impersonation_allowed_when_org_has_no_data_secrecy(self) -> None:
        """Impersonation should proceed normally when org doesn't have data secrecy."""
        with assume_test_silo_mode(SiloMode.REGION):
            self.organization.flags.prevent_superuser_access = False
            self.organization.save()

        member_user = self.create_user()
        self.create_member(user=member_user, organization=self.organization)
        self.login_as(member_user, organization_id=self.organization.id)

        from sentry.web.frontend.react_page import ReactPageView

        original_dispatch = ReactPageView.dispatch

        def patched_dispatch(self_view, request, *args, **kwargs):
            request.actual_user = self.superuser_a
            return original_dispatch(self_view, request, *args, **kwargs)

        path = reverse("sentry-organization-issue-list", args=[self.organization.slug])
        with (
            self.settings(SENTRY_SELF_HOSTED=False),
            patch.object(ReactPageView, "dispatch", patched_dispatch),
        ):
            resp = self.client.get(path)

        assert resp.status_code == 200
        self.assertTemplateNotUsed("sentry/data-secrecy.html")

    @with_feature("organizations:data-secrecy")
    def test_impersonation_no_redirect_loop_for_non_member_superuser(self) -> None:
        """Verify no infinite redirect when impersonating a superuser who is not an org member.

        This is the specific scenario that caused the auth redirect loop:
        active_organization is None, is_auth_required should return False
        for the impersonating superuser.
        """
        self.login_as(self.superuser_b, organization_id=self.organization.id, superuser=False)

        from sentry.web.frontend.react_page import ReactPageView

        original_dispatch = ReactPageView.dispatch

        def patched_dispatch(self_view, request, *args, **kwargs):
            request.actual_user = self.superuser_a
            return original_dispatch(self_view, request, *args, **kwargs)

        path = reverse("sentry-organization-issue-list", args=[self.organization.slug])
        with (
            self.settings(SENTRY_SELF_HOSTED=False),
            patch.object(ReactPageView, "dispatch", patched_dispatch),
        ):
            resp = self.client.get(path)

        # Should get data-secrecy error page, NOT a redirect (302)
        assert resp.status_code == 403
        self.assertTemplateUsed("sentry/data-secrecy.html")
