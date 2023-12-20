from sentry.models.options.user_option import UserOption
from sentry.models.useremail import UserEmail
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


class UserNotificationEmailTestBase(APITestCase):
    endpoint = "sentry-api-0-user-notifications-email"

    def setUp(self):
        self.organization2 = self.create_organization(name="Another Org", owner=self.user)
        self.project2 = self.create_project(
            organization=self.organization, teams=[self.team], name="Another Name"
        )

        self.login_as(user=self.user)


@control_silo_test
class UserNotificationEmailGetTest(UserNotificationEmailTestBase):
    def test_populates_useroptions_for_email(self):
        UserEmail.objects.create(user=self.user, email="alias@example.com", is_verified=True).save()
        UserEmail.objects.create(
            user=self.user, email="alias2@example.com", is_verified=True
        ).save()

        UserOption.objects.set_value(
            user=self.user, project=self.project, key="mail:email", value="alias@example.com"
        )
        UserOption.objects.set_value(
            user=self.user, project=self.project2, key="mail:email", value="alias2@example.com"
        )

        response = self.get_success_response("me")

        assert response.data == {
            str(self.project.id): "alias@example.com",
            str(self.project2.id): "alias2@example.com",
        }


# TODO(hybrid-cloud): Fix underlying logic, which is not silo safe
@control_silo_test()
class UserNotificationEmailTest(UserNotificationEmailTestBase):
    method = "put"

    def test_saves_and_returns_email_routing(self):
        UserEmail.objects.create(user=self.user, email="alias@example.com", is_verified=True).save()
        email = self.user.email

        data = {str(self.project.id): email, str(self.project2.id): "alias@example.com"}
        self.get_success_response("me", status_code=204, **data)

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
        self.get_error_response("me", status_code=400, **data)

    def test_email_routing_emails_must_be_valid(self):
        new_user = self.create_user(email="b@example.com")
        UserEmail.objects.create(user=new_user, email="alias2@example.com", is_verified=True).save()

        data = {str(self.project2.id): "alias2@example.com"}
        self.get_error_response("me", status_code=400, **data)
