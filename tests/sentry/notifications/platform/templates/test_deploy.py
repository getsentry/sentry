from sentry.notifications.platform.templates.deploy import (
    SLACK_MAX_BLOCKS,
    DeployReleaseData,
    build_deploy_actions,
    build_deploy_body,
    build_deploy_footer,
    filter_deploy_data,
)
from sentry.notifications.platform.types import NotificationSectionType, NotificationSource
from sentry.testutils.cases import TestCase


class FilterDeployDataTest(TestCase):
    data = DeployReleaseData(
        source=NotificationSource.DEPLOY_RELEASE,
        date="2025-01-01T00:00:00+00:00",
        author_count=1,
        commit_count=1,
        file_count=1,
        release_projects=[
            {
                "project_slug": "proj-a",
                "release_url": "https://example.com/proj-a",
                "resolved_issue_count": 0,
            },
            {
                "project_slug": "proj-b",
                "release_url": "https://example.com/proj-b",
                "resolved_issue_count": 2,
            },
        ],
        repo_name_to_commits={},
        version="1.0.0",
        environment_name="production",
    )

    def test_returns_unfiltered_when_user_id_is_none(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        result = filter_deploy_data(data=self.data, user_id=None, organization=self.organization)

        assert result.release_projects == self.data.release_projects

    def test_returns_unfiltered_when_allow_joinleave_is_true(self) -> None:
        self.organization.flags.allow_joinleave = True
        self.organization.save()

        result = filter_deploy_data(
            data=self.data, user_id=self.user.id, organization=self.organization
        )

        assert result.release_projects == self.data.release_projects

    def test_filters_to_user_team_projects(self) -> None:
        project_a = self.create_project(organization=self.organization, slug="proj-a")
        project_a.add_team(self.team)

        team_b = self.create_team(organization=self.organization)
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user, teams=[team_b])
        self.create_project(organization=self.organization, slug="proj-b", teams=[team_b])

        self.organization.flags.allow_joinleave = False
        self.organization.save()

        result = filter_deploy_data(
            data=self.data, user_id=self.user.id, organization=self.organization
        )

        slugs = [rp["project_slug"] for rp in result.release_projects]
        assert "proj-a" in slugs
        assert "proj-b" not in slugs

    def test_returns_empty_projects_when_user_has_no_teams(self) -> None:
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user)

        self.organization.flags.allow_joinleave = False
        self.organization.save()

        result = filter_deploy_data(
            data=self.data, user_id=other_user.id, organization=self.organization
        )

        assert result.release_projects == []

    def test_includes_user_settings_url_when_user_id_present(self) -> None:
        result = filter_deploy_data(
            data=self.data, user_id=self.user.id, organization=self.organization
        )

        assert result.user_settings_url is not None
        assert "notifications/deploy/" in result.user_settings_url

    def test_includes_user_settings_url_when_allow_joinleave_is_false(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        result = filter_deploy_data(
            data=self.data, user_id=self.user.id, organization=self.organization
        )

        assert result.user_settings_url is not None
        assert "notifications/deploy/" in result.user_settings_url

    def test_no_user_settings_url_when_user_id_is_none(self) -> None:
        result = filter_deploy_data(data=self.data, user_id=None, organization=self.organization)

        assert result.user_settings_url is None

    def test_does_not_mutate_original_data(self) -> None:
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user)

        self.organization.flags.allow_joinleave = False
        self.organization.save()

        original_projects = list(self.data.release_projects)

        filter_deploy_data(data=self.data, user_id=other_user.id, organization=self.organization)

        assert self.data.release_projects == original_projects


def _make_commit(i: int) -> dict:
    return {
        "author_name": f"author-{i}",
        "date": "2023-01-01T00:00:00+00:00",
        "sha": f"abc{i:04d}",
        "message": f"commit message {i}",
    }


def _make_project(i: int) -> dict:
    return {
        "project_slug": f"project-{i}",
        "release_url": f"https://example.com/project-{i}",
        "resolved_issue_count": 0,
    }


def _slack_overhead(data: DeployReleaseData) -> int:
    return (
        1  # subject HeaderBlock — always present
        + int(bool(build_deploy_footer(data)))
        + int(bool(build_deploy_actions(data)))
    )


class BuildDeployBodyBlockLimitTest(TestCase):
    """Tests that build_deploy_body never returns more sections than Slack's block limit allows."""

    def test_body_within_limit_with_many_commits(self) -> None:
        """With 60 commits, the body must be truncated and contain a truncation notice."""
        data = DeployReleaseData(
            source=NotificationSource.DEPLOY_RELEASE,
            date="2023-01-01T00:00:00+00:00",
            author_count=1,
            commit_count=60,
            file_count=1,
            release_projects=[_make_project(0)],
            repo_name_to_commits={"test-repo": [_make_commit(i) for i in range(60)]},
            version="1.0.0",
            environment_name="production",
        )

        body = build_deploy_body(data)
        max_body = SLACK_MAX_BLOCKS - _slack_overhead(data)

        assert len(body) <= max_body

        # There should be a truncation notice for the omitted commits.
        paragraph_texts = [
            block.text
            for section in body
            if section.type == NotificationSectionType.PARAGRAPH
            for block in section.blocks
        ]
        assert any("more commit" in t for t in paragraph_texts)

    def test_body_within_limit_with_many_projects(self) -> None:
        """With 45 projects and no commits, the body must not exceed Slack's block limit."""
        data = DeployReleaseData(
            source=NotificationSource.DEPLOY_RELEASE,
            date="2023-01-01T00:00:00+00:00",
            author_count=0,
            commit_count=0,
            file_count=0,
            release_projects=[_make_project(i) for i in range(45)],
            repo_name_to_commits={},
            version="1.0.0",
            environment_name="production",
        )

        body = build_deploy_body(data)
        max_body = SLACK_MAX_BLOCKS - _slack_overhead(data)

        assert len(body) <= max_body

    def test_body_within_limit_small_payload(self) -> None:
        """A small release (2 projects, 3 commits) should not be truncated."""
        data = DeployReleaseData(
            source=NotificationSource.DEPLOY_RELEASE,
            date="2023-01-01T00:00:00+00:00",
            author_count=2,
            commit_count=3,
            file_count=5,
            release_projects=[_make_project(0), _make_project(1)],
            repo_name_to_commits={"repo-a": [_make_commit(i) for i in range(3)]},
            version="1.0.0",
            environment_name="production",
        )

        body = build_deploy_body(data)
        max_body = SLACK_MAX_BLOCKS - _slack_overhead(data)

        assert len(body) <= max_body
        # No truncation notice expected for a small payload.
        paragraph_texts = [
            block.text
            for section in body
            if section.type == NotificationSectionType.PARAGRAPH
            for block in section.blocks
        ]
        assert not any("not shown" in t for t in paragraph_texts)
