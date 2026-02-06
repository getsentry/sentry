from sentry.testutils.cases import TestCase
from sentry.testutils.silo import control_silo_test
from sentry.users.models.user_option import UserOption


@control_silo_test
class UserOptionManagerTest(TestCase):
    def test_unset_value(self) -> None:
        project = self.create_project()
        UserOption.objects.set_value(self.user, "foo", "bar", project=project)
        assert UserOption.objects.filter(user=self.user, project_id=project.id, key="foo").exists()

        UserOption.objects.unset_value(self.user, project, "foo")
        assert not UserOption.objects.filter(
            user=self.user, project_id=project.id, key="foo"
        ).exists()
