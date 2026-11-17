from unittest import mock

from sentry.seer import nav_snapshot
from sentry.testutils.cases import APITestCase

_SNAPSHOT = {
    "version": 1,
    "entries": [
        {"crumbs": "Explore → Logs", "path": "/explore/logs/", "when": {"flag": "ourlogs-enabled"}},
        {"crumbs": "Explore → Releases", "path": "/explore/releases/"},
        {
            "crumbs": "Settings → Organization → Auth",
            "path": "/settings/auth/",
            "when": {"scope": "org:write"},
        },
        {
            "crumbs": "Settings → Organization → Teams → <team> → Members",
            "path": "/settings/teams/{team_slug}/members/",
            "sub_page": True,
        },
        {
            "crumbs": "Explore → Investigations",
            "path": "/explore/investigations/",
            "when": {"org": "openMembership"},
        },
    ],
}


@mock.patch.object(nav_snapshot, "_SNAPSHOT", _SNAPSHOT)
class OrganizationSeerNavLinksTest(APITestCase):
    endpoint = "sentry-api-0-organization-seer-nav-links"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_owner_sees_pages_their_org_and_permissions_allow(self) -> None:
        with self.feature("organizations:ourlogs-enabled"):
            response = self.get_success_response(self.organization.slug)
        assert response.data["links"] == [
            {"crumbs": "Explore → Logs", "path": "/explore/logs/", "condition": None},
            {"crumbs": "Explore → Releases", "path": "/explore/releases/", "condition": None},
            {
                "crumbs": "Settings → Organization → Auth",
                "path": "/settings/auth/",
                "condition": None,
            },
            {
                "crumbs": "Explore → Investigations",
                "path": "/explore/investigations/",
                "condition": "organization setting `openMembership` enabled",
            },
        ]

    def test_member_without_scope_does_not_see_the_page(self) -> None:
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(member)
        response = self.get_success_response(self.organization.slug)
        assert [link["crumbs"] for link in response.data["links"]] == [
            "Explore → Releases",
            "Explore → Investigations",
        ]

    def test_section_includes_sub_pages(self) -> None:
        response = self.get_success_response(self.organization.slug, section="settings")
        assert [link["crumbs"] for link in response.data["links"]] == [
            "Settings → Organization → Auth",
            "Settings → Organization → Teams → <team> → Members",
        ]

    def test_include_sub_pages_false_overrides_section_default(self) -> None:
        response = self.get_success_response(
            self.organization.slug, section="settings", includeSubPages="false"
        )
        assert [link["crumbs"] for link in response.data["links"]] == [
            "Settings → Organization → Auth"
        ]

    def test_invalid_include_sub_pages(self) -> None:
        response = self.get_error_response(
            self.organization.slug, includeSubPages="maybe", status_code=400
        )
        assert response.data == {"detail": "Invalid query parameters."}

    def test_non_member_is_forbidden(self) -> None:
        self.login_as(self.create_user())
        self.get_error_response(self.organization.slug, status_code=403)
