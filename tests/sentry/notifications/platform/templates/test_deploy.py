from django.conf import settings

from sentry.models.activity import Activity
from sentry.notifications.platform.target import (
    GenericNotificationTarget,
    IntegrationNotificationTarget,
)
from sentry.notifications.platform.templates.deploy import (
    DeployReleaseData,
    DeployReleaseTemplate,
    create_target_specific_deploy_data,
)
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationSource,
    NotificationTargetResourceType,
)
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class CreateTargetSpecificDeployDataTest(TestCase):
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
    unknown_target = GenericNotificationTarget(
        provider_key=NotificationProviderKey.EMAIL,
        resource_type=NotificationTargetResourceType.EMAIL,
        resource_id="no-user-id@example.com",
    )

    def setUp(self) -> None:
        self.activity = Activity(
            project=self.project,
            type=ActivityType.DEPLOY.value,
            data={"version": "1.0.0"},
        )
        self.user_target = GenericNotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id="user@example.com",
            specific_data={"user_id": self.user.id},
        )

    def create_email_target(self, user_id: int) -> GenericNotificationTarget:
        return GenericNotificationTarget(
            provider_key=NotificationProviderKey.EMAIL,
            resource_type=NotificationTargetResourceType.EMAIL,
            resource_id="user@example.com",
            specific_data={"user_id": user_id},
        )

    def test_preserves_projects_when_target_has_no_user(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        result = create_target_specific_deploy_data(
            data=self.data,
            activity=self.activity,
            target=self.unknown_target,
            organization=self.organization,
        )

        assert result.release_projects == self.data.release_projects

    def test_preserves_projects_when_all_projects_are_visible(self) -> None:
        self.organization.flags.allow_joinleave = True
        self.organization.save()

        result = create_target_specific_deploy_data(
            data=self.data,
            activity=self.activity,
            target=self.create_email_target(self.user.id),
            organization=self.organization,
        )

        assert result.release_projects == self.data.release_projects

    def test_filters_projects_for_target_user(self) -> None:
        project_a = self.create_project(organization=self.organization, slug="proj-a")
        project_a.add_team(self.team)

        team_b = self.create_team(organization=self.organization)
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user, teams=[team_b])
        self.create_project(organization=self.organization, slug="proj-b", teams=[team_b])

        self.organization.flags.allow_joinleave = False
        self.organization.save()

        result = create_target_specific_deploy_data(
            data=self.data,
            activity=self.activity,
            target=self.create_email_target(self.user.id),
            organization=self.organization,
        )

        slugs = [rp["project_slug"] for rp in result.release_projects]
        assert "proj-a" in slugs
        assert "proj-b" not in slugs

    def test_returns_no_projects_when_target_user_has_no_teams(self) -> None:
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user)

        self.organization.flags.allow_joinleave = False
        self.organization.save()

        result = create_target_specific_deploy_data(
            data=self.data,
            activity=self.activity,
            target=self.create_email_target(other_user.id),
            organization=self.organization,
        )

        assert result.release_projects == []

    def test_adds_user_settings_url_for_target_user(self) -> None:
        result = create_target_specific_deploy_data(
            data=self.data,
            activity=self.activity,
            target=self.create_email_target(self.user.id),
            organization=self.organization,
        )

        assert result.user_settings_url is not None
        assert "notifications/deploy/" in result.user_settings_url

    def test_adds_user_settings_url_when_projects_are_filtered(self) -> None:
        self.organization.flags.allow_joinleave = False
        self.organization.save()

        result = create_target_specific_deploy_data(
            data=self.data,
            activity=self.activity,
            target=self.create_email_target(self.user.id),
            organization=self.organization,
        )

        assert result.user_settings_url is not None
        assert "notifications/deploy/" in result.user_settings_url

    def test_omits_user_settings_url_when_target_has_no_user(self) -> None:
        result = create_target_specific_deploy_data(
            data=self.data,
            activity=self.activity,
            target=self.unknown_target,
            organization=self.organization,
        )

        assert result.user_settings_url is None

    def test_does_not_mutate_original_data(self) -> None:
        other_user = self.create_user()
        self.create_member(organization=self.organization, user=other_user)

        self.organization.flags.allow_joinleave = False
        self.organization.save()

        original_projects = list(self.data.release_projects)

        create_target_specific_deploy_data(
            data=self.data,
            activity=self.activity,
            target=self.create_email_target(other_user.id),
            organization=self.organization,
        )

        assert self.data.release_projects == original_projects

    def test_adds_email_metadata_for_email_target(self) -> None:
        self.project.update_option("mail:subject_prefix", "[Project]")

        result = create_target_specific_deploy_data(
            data=self.data,
            activity=self.activity,
            target=self.unknown_target,
            organization=self.organization,
        )
        headers = result.email_headers
        assert headers is not None
        assert headers == {
            "X-SMTPAPI": '{"category":"release_activity"}',
            "X-Sentry-Project": self.project.slug,
            "Message-Id": headers["Message-Id"],
            "List-Id": (
                f"<{self.project.slug}.{self.organization.slug}."
                f"{settings.SENTRY_MAIL_LIST_NAMESPACE}>"
            ),
        }
        assert result.email_subject_prefix == "[Project] "

        rendered_template = DeployReleaseTemplate().render(result)
        assert rendered_template.email_headers == headers
        assert rendered_template.email_subject_prefix == "[Project] "

    def test_omits_email_metadata_for_non_email_target(self) -> None:
        target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.SLACK,
            resource_type=NotificationTargetResourceType.DIRECT_MESSAGE,
            resource_id="U12345",
            integration_id=1,
            organization_id=self.organization.id,
        )

        result = create_target_specific_deploy_data(
            data=self.data,
            activity=self.activity,
            target=target,
            organization=self.organization,
        )

        assert result.email_headers is None
        assert result.email_subject_prefix is None
