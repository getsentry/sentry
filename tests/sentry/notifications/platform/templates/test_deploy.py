from sentry.notifications.platform.templates.deploy import (
    DeployReleaseData,
    filter_deploy_data,
)
from sentry.notifications.platform.types import NotificationSource
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

    def test_does_not_mutate_original_data(self) -> None:
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user)

        self.organization.flags.allow_joinleave = False
        self.organization.save()

        original_projects = list(self.data.release_projects)

        filter_deploy_data(data=self.data, user_id=other_user.id, organization=self.organization)

        assert self.data.release_projects == original_projects
