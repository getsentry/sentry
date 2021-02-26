from sentry.models import Organization, User
from sentry.demo.tasks import delete_organization_and_user
from sentry.testutils import TestCase


class DeleteOrganizationAndUser(TestCase):
    def test_simple(self):
        org = self.create_organization()
        user = self.create_user()
        with self.tasks():
            delete_organization_and_user(org.id, user.id)

        assert not Organization.objects.filter(id=org.id).exists()
        assert not User.objects.filter(id=user.id).exists()
