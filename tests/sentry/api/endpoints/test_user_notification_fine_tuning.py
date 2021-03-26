from sentry.models import NotificationSetting, UserEmail, UserOption
from sentry.models.integration import ExternalProviders
from sentry.notifications.types import (
    NotificationSettingTypes,
    NotificationSettingOptionValues,
)
from sentry.testutils import APITestCase


class UserNotificationFineTuningTest(APITestCase):
    endpoint = "sentry-api-0-user-notifications-fine-tuning"

    def setUp(self):
        self.user = self.create_user(email="a@example.com")
        self.org = self.create_organization(name="Org Name", owner=self.user)
        self.org2 = self.create_organization(name="Another Org", owner=self.user)
        self.team = self.create_team(name="Team Name", organization=self.org, members=[self.user])
        self.project = self.create_project(
            organization=self.org, teams=[self.team], name="Project Name"
        )

        self.project2 = self.create_project(
            organization=self.org, teams=[self.team], name="Another Name"
        )

        self.login_as(user=self.user)

    def test_returns_correct_defaults(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
            project=self.project,
        )
        response = self.get_valid_response("me", "alerts")
        assert response.data.get(self.project.id) == "1"

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
            organization=self.org,
        )
        response = self.get_valid_response("me", "deploy")
        assert response.data.get(self.org.id) == "2"

        UserOption.objects.create(
            user=self.user,
            organization=None,
            key="reports:disabled-organizations",
            value=[self.org.id],
        )
        response = self.get_valid_response("me", "reports")
        assert response.data.get(self.org.id) == "0"

    def test_invalid_notification_type(self):
        self.get_valid_response("me", "invalid", status_code=404)
        self.get_valid_response("me", "invalid", method="put", status_code=404)

    def test_update_invalid_project(self):
        self.get_valid_response("me", "alerts", method="put", status_code=403, **{"123": 1})

    def test_invalid_id_value(self):
        self.get_valid_response("me", "alerts", method="put", status_code=400, **{"nope": 1})

    def test_saves_and_returns_alerts(self):
        self.get_valid_response(
            "me",
            "alerts",
            method="put",
            status_code=204,
            **{str(self.project.id): 1, str(self.project2.id): 0},
        )

        assert (
            UserOption.objects.get(user=self.user, project=self.project, key="mail:alert").value
            == 1
        )

        assert (
            UserOption.objects.get(user=self.user, project=self.project2, key="mail:alert").value
            == 0
        )

        # Can return to default
        self.get_valid_response(
            "me", "alerts", method="put", status_code=204, **{str(self.project.id): -1}
        )

        assert not UserOption.objects.filter(
            user=self.user, project=self.project, key="mail:alert"
        ).exists()

        assert (
            UserOption.objects.get(user=self.user, project=self.project2, key="mail:alert").value
            == 0
        )

    def test_saves_and_returns_workflow(self):
        self.get_valid_response(
            "me",
            "workflow",
            method="put",
            status_code=204,
            **{str(self.project.id): 1, str(self.project2.id): 2},
        )

        assert (
            UserOption.objects.get(
                user=self.user, project=self.project, key="workflow:notifications"
            ).value
            == "1"
        )

        assert (
            UserOption.objects.get(
                user=self.user, project=self.project2, key="workflow:notifications"
            ).value
            == "2"
        )

        # Can return to default
        self.get_valid_response(
            "me", "workflow", method="put", status_code=204, **{str(self.project.id): -1}
        )

        assert not UserOption.objects.filter(
            user=self.user, project=self.project, key="workflow:notifications"
        )

        assert (
            UserOption.objects.get(
                user=self.user, project=self.project2, key="workflow:notifications"
            ).value
            == "2"
        )

    def test_saves_and_returns_email_routing(self):
        UserEmail.objects.create(user=self.user, email="alias@example.com", is_verified=True).save()

        data = {str(self.project.id): "a@example.com", str(self.project2.id): "alias@example.com"}
        self.get_valid_response("me", "email", method="put", status_code=204, **data)

        assert (
            UserOption.objects.get(user=self.user, project=self.project, key="mail:email").value
            == "a@example.com"
        )

        assert (
            UserOption.objects.get(user=self.user, project=self.project2, key="mail:email").value
            == "alias@example.com"
        )

    def test_email_routing_emails_must_be_verified(self):
        UserEmail.objects.create(
            user=self.user, email="alias@example.com", is_verified=False
        ).save()

        self.get_valid_response(
            "me",
            "email",
            method="put",
            status_code=400,
            **{str(self.project.id): "alias@example.com"},
        )

    def test_email_routing_emails_must_be_valid(self):
        new_user = self.create_user(email="b@example.com")
        UserEmail.objects.create(user=new_user, email="alias2@example.com", is_verified=True).save()

        self.get_valid_response(
            "me",
            "email",
            method="put",
            status_code=400,
            **{str(self.project2.id): "alias2@example.com"},
        )

    def test_saves_and_returns_deploy(self):
        self.get_valid_response(
            "me", "deploy", method="put", status_code=204, **{str(self.org.id): 4}
        )

        assert (
            UserOption.objects.get(user=self.user, organization=self.org, key="deploy-emails").value
            == "4"
        )

        self.get_valid_response(
            "me", "deploy", method="put", status_code=204, **{str(self.org.id): 2}
        )
        assert (
            UserOption.objects.get(user=self.user, organization=self.org, key="deploy-emails").value
            == "2"
        )

        self.get_valid_response(
            "me", "deploy", method="put", status_code=204, **{str(self.org.id): -1}
        )
        assert not UserOption.objects.filter(
            user=self.user, organization=self.org, key="deploy-emails"
        ).exists()

    def test_saves_and_returns_weekly_reports(self):
        self.get_valid_response(
            "me",
            "reports",
            method="put",
            status_code=204,
            **{str(self.org.id): 0, str(self.org2.id): "0"},
        )

        assert set(
            UserOption.objects.get(user=self.user, key="reports:disabled-organizations").value
        ) == {self.org.id, self.org2.id}

        self.get_valid_response(
            "me", "reports", method="put", status_code=204, **{str(self.org.id): 1}
        )
        assert set(
            UserOption.objects.get(user=self.user, key="reports:disabled-organizations").value
        ) == {self.org2.id}

        self.get_valid_response(
            "me", "reports", method="put", status_code=204, **{str(self.org.id): 0}
        )
        assert set(
            UserOption.objects.get(user=self.user, key="reports:disabled-organizations").value
        ) == {self.org.id, self.org2.id}

    def test_enable_weekly_reports_from_default_setting(self):
        self.get_valid_response(
            "me",
            "reports",
            method="put",
            status_code=204,
            **{str(self.org.id): 1, str(self.org2.id): "1"},
        )

        assert (
            set(UserOption.objects.get(user=self.user, key="reports:disabled-organizations").value)
            == set()
        )

        # can disable
        self.get_valid_response(
            "me", "reports", method="put", status_code=204, **{str(self.org.id): 0}
        )
        assert set(
            UserOption.objects.get(user=self.user, key="reports:disabled-organizations").value
        ) == {self.org.id}

        # re-enable
        self.get_valid_response(
            "me", "reports", method="put", status_code=204, **{str(self.org.id): 1}
        )
        assert (
            set(UserOption.objects.get(user=self.user, key="reports:disabled-organizations").value)
            == set()
        )

    def test_permissions(self):
        new_user = self.create_user(email="b@example.com")
        new_org = self.create_organization(name="New Org")
        new_team = self.create_team(name="New Team", organization=new_org, members=[new_user])
        new_project = self.create_project(
            organization=new_org, teams=[new_team], name="New Project"
        )

        self.get_valid_response(
            "me", "reports", method="put", status_code=403, **{str(new_org.id): 0}
        )

        assert not UserOption.objects.filter(
            user=self.user, organization=new_org, key="reports"
        ).exists()

        self.get_valid_response(
            "me", "alerts", method="put", status_code=403, **{str(new_project.id): 1}
        )

        assert not UserOption.objects.filter(
            user=self.user, project=new_project, key="mail:alert"
        ).exists()
