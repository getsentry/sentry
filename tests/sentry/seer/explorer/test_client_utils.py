from sentry.models.organizationmember import OrganizationMember
from sentry.seer.explorer.client_utils import (
    collect_user_org_context,
    has_seer_explorer_access_with_detail,
    snapshot_to_markdown,
)
from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestCase
from sentry.testutils.requests import make_request


class TestHasSeerExplorerAccessWithDetail(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.org = self.create_organization(owner=self.user)
        self.org.flags.allow_joinleave = True
        self.org.save()

    def test_gen_ai_features_disabled(self) -> None:
        result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (False, "Feature flag not enabled")

    def test_hide_ai_features_option_set(self) -> None:
        self.org.update_option("sentry:hide_ai_features", True)
        with self.feature("organizations:gen-ai-features"):
            result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (False, "AI features are disabled for this organization.")

    def test_no_explorer_flags_enabled(self) -> None:
        with self.feature("organizations:gen-ai-features"):
            result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (False, "Feature flag not enabled")

    def test_only_seer_explorer_flag(self) -> None:
        with self.feature(
            {"organizations:gen-ai-features": True, "organizations:seer-explorer": True}
        ):
            result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (True, None)

    def test_only_autofix_on_explorer_flag(self) -> None:
        with self.feature(
            {"organizations:gen-ai-features": True, "organizations:autofix-on-explorer": True}
        ):
            result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (True, None)

    def test_all_explorer_flags_enabled(self) -> None:
        with self.feature(
            {
                "organizations:gen-ai-features": True,
                "organizations:seer-explorer": True,
                "organizations:autofix-on-explorer": True,
            }
        ):
            result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (True, None)

    def test_allow_joinleave_disabled(self) -> None:
        self.org.flags.allow_joinleave = False
        self.org.save()
        with self.feature(
            {
                "organizations:gen-ai-features": True,
                "organizations:seer-explorer": True,
                "organizations:autofix-on-explorer": True,
            }
        ):
            result = has_seer_explorer_access_with_detail(self.org, self.user)
        assert result == (
            False,
            "Organization does not have open team membership enabled. Seer requires this to aggregate context across all projects and allow members to ask questions freely.",
        )


class CollectUserOrgContextTest(TestCase):
    """Test the collect_user_org_context helper function"""

    def setUp(self) -> None:
        super().setUp()
        self.project1 = self.create_project(
            organization=self.organization, teams=[self.team], slug="project-1"
        )
        self.project2 = self.create_project(
            organization=self.organization, teams=[self.team], slug="project-2"
        )
        self.other_team = self.create_team(organization=self.organization, slug="other-team")
        self.other_project = self.create_project(
            organization=self.organization, teams=[self.other_team], slug="other-project"
        )

    def test_collect_context_with_member(self) -> None:
        """Test context collection for a user who is an organization member"""
        context = collect_user_org_context(self.user, self.organization)

        assert context is not None
        assert context["org_slug"] == self.organization.slug
        assert context.get("user_id") == self.user.id
        assert context.get("user_name") == self.user.name
        assert context.get("user_email") == self.user.email
        assert context.get("user_timezone") is None  # No timezone set by default
        assert context.get("user_ip") is None  # No IP address set by default

        # Should have exactly one team
        assert "user_teams" in context
        assert len(context["user_teams"]) == 1
        assert context["user_teams"][0]["slug"] == self.team.slug

        # User projects should include project1 and project2 (both on self.team)
        assert "user_projects" in context
        user_project_slugs = {p["slug"] for p in context["user_projects"]}
        assert user_project_slugs == {"project-1", "project-2"}

        # All org projects should include all 3 projects
        assert "all_org_projects" in context
        all_project_slugs = {p["slug"] for p in context["all_org_projects"]}
        assert all_project_slugs == {"project-1", "project-2", "other-project"}
        all_project_ids = {p["id"] for p in context["all_org_projects"]}
        assert all_project_ids == {self.project1.id, self.project2.id, self.other_project.id}

    def test_collect_context_with_multiple_teams(self) -> None:
        """Test context collection for a user in multiple teams"""
        team2 = self.create_team(organization=self.organization, slug="team-2")
        member = OrganizationMember.objects.get(
            organization=self.organization, user_id=self.user.id
        )
        with unguarded_write(using="default"):
            member.teams.add(team2)

        context = collect_user_org_context(self.user, self.organization)

        assert context is not None
        assert "user_teams" in context
        team_slugs = {t["slug"] for t in context["user_teams"]}
        assert team_slugs == {self.team.slug, "team-2"}

    def test_collect_context_with_no_teams(self) -> None:
        """Test context collection for a member with no team membership"""
        member = OrganizationMember.objects.get(
            organization=self.organization, user_id=self.user.id
        )
        # Remove user from all teams
        with unguarded_write(using="default"):
            member.teams.clear()

        context = collect_user_org_context(self.user, self.organization)

        assert context is not None
        assert context.get("user_teams") == []
        assert context.get("user_projects") == []
        # All org projects should still be present
        assert "all_org_projects" in context
        all_project_slugs = {p["slug"] for p in context["all_org_projects"]}
        assert all_project_slugs == {"project-1", "project-2", "other-project"}

    def test_collect_context_with_non_member_returns_default(self) -> None:
        """Test context collection for a user who is not an organization member"""
        other_user = self.create_user()
        context = collect_user_org_context(other_user, self.organization)

        all_project_slugs = {p["slug"] for p in context["all_org_projects"]}
        assert context == {
            "org_slug": self.organization.slug,
            "all_org_projects": context["all_org_projects"],
        }
        assert all_project_slugs == {"project-1", "project-2", "other-project"}

    def test_collect_context_with_timezone(self) -> None:
        """Test context collection includes user's timezone setting"""
        from sentry.users.services.user_option import user_option_service

        user_option_service.set_option(
            user_id=self.user.id, key="timezone", value="America/Los_Angeles"
        )

        context = collect_user_org_context(self.user, self.organization)

        assert context is not None
        assert context.get("user_timezone") == "America/Los_Angeles"

    def test_collect_context_with_request(self) -> None:
        """Test context collection includes request metadata like IP address"""
        request, _ = make_request()
        context = collect_user_org_context(self.user, self.organization, request=request)

        assert context is not None
        assert context.get("user_ip") == request.META.get("REMOTE_ADDR")


class SnapshotToMarkdownTest(TestCase):
    def test_single_node(self) -> None:
        snapshot = {
            "version": 1,
            "nodes": [
                {
                    "nodeType": "dashboard",
                    "data": {"title": "Backend Health", "widgetCount": 3},
                    "children": [],
                }
            ],
        }
        result = snapshot_to_markdown(snapshot)
        assert "# Dashboard" in result
        assert '- **title**: "Backend Health"' in result
        assert "- **widgetCount**: 3" in result

    def test_nested_nodes(self) -> None:
        snapshot = {
            "version": 1,
            "nodes": [
                {
                    "nodeType": "dashboard",
                    "data": {"title": "My Dashboard"},
                    "children": [
                        {
                            "nodeType": "widget",
                            "data": {"title": "Error Rate"},
                            "children": [
                                {
                                    "nodeType": "chart",
                                    "data": {"query": "count()"},
                                    "children": [],
                                }
                            ],
                        }
                    ],
                }
            ],
        }
        result = snapshot_to_markdown(snapshot)
        assert "# Dashboard" in result
        assert "## Widget" in result
        assert "### Chart" in result
        assert '- **query**: "count()"' in result

    def test_empty_nodes(self) -> None:
        assert snapshot_to_markdown({"version": 1, "nodes": []}) == ""

    def test_node_with_no_data(self) -> None:
        snapshot = {
            "version": 1,
            "nodes": [{"nodeType": "dashboard", "data": None, "children": []}],
        }
        result = snapshot_to_markdown(snapshot)
        assert "# Dashboard" in result
        assert "not an exact screenshot" in result

    def test_node_with_non_dict_data(self) -> None:
        snapshot = {
            "version": 1,
            "nodes": [{"nodeType": "widget", "data": "some string", "children": []}],
        }
        result = snapshot_to_markdown(snapshot)
        assert "# Widget" in result
        assert '- "some string"' in result
