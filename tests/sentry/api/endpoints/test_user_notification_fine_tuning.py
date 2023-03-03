from sentry.models import NotificationSetting, UserEmail, UserOption
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.testutils import APITestCase
from sentry.testutils.silo import control_silo_test
from sentry.types.integrations import ExternalProviders


@control_silo_test
class UserNotificationFineTuningTestBase(APITestCase):
    endpoint = "sentry-api-0-user-notifications-fine-tuning"

    def setUp(self):
        self.organization2 = self.create_organization(name="Another Org", owner=self.user)
        self.project2 = self.create_project(
            organization=self.organization, teams=[self.team], name="Another Name"
        )

        self.login_as(user=self.user)

    def test_invalid_notification_type(self):
        """This is run twice because of inheritance."""
        self.get_error_response("me", "invalid", status_code=404)


@control_silo_test
class UserNotificationFineTuningGetTest(UserNotificationFineTuningTestBase):
    def test_returns_correct_defaults(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
            project=self.project,
        )
        response = self.get_success_response("me", "alerts")
        assert response.data.get(self.project.id) == "1"

        NotificationSetting.objects.update_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
            organization=self.organization,
        )
        response = self.get_success_response("me", "deploy")
        assert response.data.get(self.organization.id) == "2"

        UserOption.objects.create(
            user=self.user,
            organization_id=None,
            key="reports:disabled-organizations",
            value=[self.organization.id],
        )
        response = self.get_success_response("me", "reports")
        assert response.data.get(self.organization.id) == "0"


@control_silo_test
class UserNotificationFineTuningTest(UserNotificationFineTuningTestBase):
    method = "put"

    def test_update_invalid_project(self):
        self.get_error_response("me", "alerts", status_code=403, **{"123": 1})

    def test_invalid_id_value(self):
        self.get_error_response("me", "alerts", status_code=400, **{"nope": 1})

    def test_saves_and_returns_alerts(self):
        data = {str(self.project.id): 1, str(self.project2.id): 0}
        self.get_success_response("me", "alerts", status_code=204, **data)

        value1 = NotificationSetting.objects.get_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.ISSUE_ALERTS,
            user=self.user,
            project=self.project,
        )

        value2 = NotificationSetting.objects.get_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.ISSUE_ALERTS,
            user=self.user,
            project=self.project2,
        )

        assert value1 == NotificationSettingOptionValues.ALWAYS
        assert value2 == NotificationSettingOptionValues.NEVER

        # Can return to default
        data = {str(self.project.id): -1}
        self.get_success_response("me", "alerts", status_code=204, **data)

        value1 = NotificationSetting.objects.get_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.ISSUE_ALERTS,
            user=self.user,
            project=self.project,
        )
        value2 = NotificationSetting.objects.get_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.ISSUE_ALERTS,
            user=self.user,
            project=self.project2,
        )

        assert value1 == NotificationSettingOptionValues.DEFAULT
        assert value2 == NotificationSettingOptionValues.NEVER

    def test_saves_and_returns_workflow(self):
        data = {str(self.project.id): 1, str(self.project2.id): 2}
        self.get_success_response("me", "workflow", status_code=204, **data)

        value = NotificationSetting.objects.get_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.WORKFLOW,
            user=self.user,
            project=self.project,
        )
        value2 = NotificationSetting.objects.get_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.WORKFLOW,
            user=self.user,
            project=self.project2,
        )

        assert value == NotificationSettingOptionValues.SUBSCRIBE_ONLY
        assert value2 == NotificationSettingOptionValues.NEVER

        # Can return to default
        data = {str(self.project.id): -1}
        self.get_success_response("me", "workflow", status_code=204, **data)

        value1 = NotificationSetting.objects.get_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.WORKFLOW,
            user=self.user,
            project=self.project,
        )
        value2 = NotificationSetting.objects.get_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.WORKFLOW,
            user=self.user,
            project=self.project2,
        )

        assert value1 == NotificationSettingOptionValues.DEFAULT
        assert value2 == NotificationSettingOptionValues.NEVER

    def test_saves_and_returns_email_routing(self):
        UserEmail.objects.create(user=self.user, email="alias@example.com", is_verified=True).save()
        email = self.user.email

        data = {str(self.project.id): email, str(self.project2.id): "alias@example.com"}
        self.get_success_response("me", "email", status_code=204, **data)

        value1 = UserOption.objects.get(
            user=self.user, project_id=self.project.id, key="mail:email"
        ).value
        value2 = UserOption.objects.get(
            user=self.user, project_id=self.project2.id, key="mail:email"
        ).value

        assert value1 == email
        assert value2 == "alias@example.com"

    def test_email_routing_emails_must_be_verified(self):
        UserEmail.objects.create(
            user=self.user, email="alias@example.com", is_verified=False
        ).save()

        data = {str(self.project.id): "alias@example.com"}
        self.get_error_response("me", "email", status_code=400, **data)

    def test_email_routing_emails_must_be_valid(self):
        new_user = self.create_user(email="b@example.com")
        UserEmail.objects.create(user=new_user, email="alias2@example.com", is_verified=True).save()

        data = {str(self.project2.id): "alias2@example.com"}
        self.get_error_response("me", "email", status_code=400, **data)

    def test_saves_and_returns_deploy(self):
        data = {str(self.organization.id): 4}
        self.get_success_response("me", "deploy", status_code=204, **data)

        value = NotificationSetting.objects.get_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.DEPLOY,
            user=self.user,
            organization=self.organization,
        )
        assert value == NotificationSettingOptionValues.NEVER

        data = {str(self.organization.id): 2}
        self.get_success_response("me", "deploy", status_code=204, **data)

        value = NotificationSetting.objects.get_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.DEPLOY,
            user=self.user,
            organization=self.organization,
        )
        assert value == NotificationSettingOptionValues.ALWAYS

        data = {str(self.organization.id): -1}
        self.get_success_response("me", "deploy", status_code=204, **data)

        value = NotificationSetting.objects.get_settings(
            provider=ExternalProviders.EMAIL,
            type=NotificationSettingTypes.DEPLOY,
            user=self.user,
            organization=self.organization,
        )
        assert value == NotificationSettingOptionValues.DEFAULT

    def test_saves_and_returns_weekly_reports(self):
        data = {str(self.organization.id): 0, str(self.organization2.id): "0"}
        self.get_success_response("me", "reports", status_code=204, **data)

        assert set(
            UserOption.objects.get(user=self.user, key="reports:disabled-organizations").value
        ) == {self.organization.id, self.organization2.id}

        data = {str(self.organization.id): 1}
        self.get_success_response("me", "reports", status_code=204, **data)
        assert set(
            UserOption.objects.get(user=self.user, key="reports:disabled-organizations").value
        ) == {self.organization2.id}

        data = {str(self.organization.id): 0}
        self.get_success_response("me", "reports", status_code=204, **data)
        assert set(
            UserOption.objects.get(user=self.user, key="reports:disabled-organizations").value
        ) == {self.organization.id, self.organization2.id}

    def test_enable_weekly_reports_from_default_setting(self):
        data = {str(self.organization.id): 1, str(self.organization2.id): "1"}
        self.get_success_response("me", "reports", status_code=204, **data)

        assert (
            set(UserOption.objects.get(user=self.user, key="reports:disabled-organizations").value)
            == set()
        )

        # can disable
        data = {str(self.organization.id): 0}
        self.get_success_response("me", "reports", status_code=204, **data)
        assert set(
            UserOption.objects.get(user=self.user, key="reports:disabled-organizations").value
        ) == {self.organization.id}

        # re-enable
        data = {str(self.organization.id): 1}
        self.get_success_response("me", "reports", status_code=204, **data)
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

        data = {str(new_org.id): 0}
        self.get_error_response("me", "reports", status_code=403, **data)

        assert not UserOption.objects.filter(
            user=self.user, organization_id=new_org.id, key="reports"
        ).exists()

        data = {str(new_project.id): 1}
        self.get_error_response("me", "alerts", status_code=403, **data)

        value = NotificationSetting.objects.get_settings(
            ExternalProviders.EMAIL,
            NotificationSettingTypes.ISSUE_ALERTS,
            user=self.user,
            project=new_project,
        )
        assert value == NotificationSettingOptionValues.DEFAULT
