from sentry.seer.explorer.client_utils import (
    collect_user_org_context,
    has_seer_explorer_access_with_detail,
)
from sentry.testutils.cases import TestCase


class TestHasSeerExplorerAccessWithDetail(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.org.flags.allow_joinleave = True
        self.org.save()

    def test_gen_ai_features_disabled(self):
        result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (False, "Feature flag not enabled")

    def test_hide_ai_features_option_set(self):
        self.org.update_option("sentry:hide_ai_features", True)
        with self.feature("organizations:gen-ai-features"):
            result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (False, "AI features are disabled for this organization.")

    def test_no_explorer_flags_enabled(self):
        with self.feature("organizations:gen-ai-features"):
            result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (False, "Feature flag not enabled")

    def test_only_seer_explorer_flag(self):
        with self.feature(
            {"organizations:gen-ai-features": True, "organizations:seer-explorer": True}
        ):
            result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (True, None)

    def test_only_autofix_on_explorer_flag(self):
        with self.feature(
            {"organizations:gen-ai-features": True, "organizations:autofix-on-explorer": True}
        ):
            result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (True, None)

    def test_only_autofix_on_explorer_v2_flag(self):
        with self.feature(
            {"organizations:gen-ai-features": True, "organizations:autofix-on-explorer-v2": True}
        ):
            result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (True, None)

    def test_all_explorer_flags_enabled(self):
        with self.feature(
            {
                "organizations:gen-ai-features": True,
                "organizations:seer-explorer": True,
                "organizations:autofix-on-explorer": True,
                "organizations:autofix-on-explorer-v2": True,
            }
        ):
            result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (True, None)

    def test_allow_joinleave_disabled(self):
        self.org.flags.allow_joinleave = False
        self.org.save()
        with self.feature(
            {
                "organizations:gen-ai-features": True,
                "organizations:seer-explorer": True,
                "organizations:autofix-on-explorer": True,
                "organizations:autofix-on-explorer-v2": True,
            }
        ):
            result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (
            False,
            "Organization does not have open team membership enabled. Seer requires this to aggregate context across all projects and allow members to ask questions freely.",
        )


class TestCollectUserOrgContext(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.project = self.create_project(organization=self.org)

    def test_user_not_org_member_returns_default(self):
        other_user = self.create_user()
        result = collect_user_org_context(other_user, self.org)
        assert result == {
            "org_slug": self.org.slug,
            "all_org_projects": [{"id": self.project.id, "slug": self.project.slug}],
        }
