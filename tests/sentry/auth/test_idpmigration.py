import sentry.auth.idpmigration as idpmigration
from sentry.models import OrganizationMember
from sentry.testutils import TestCase
from sentry.utils.compat import mock


class IDPMigrationTests(TestCase):
    def setUp(self):
        self.user = self.create_user()
        self.email = "test@example.com"
        self.org = self.create_organization()
        OrganizationMember.objects.create(organization=self.org, user=self.user)

    @mock.patch("sentry.auth.idpmigration.send_confirm_email")
    def test_create_verification_key(self, send_confirm_email):
        idpmigration.create_verification_key(self.user, self.org, self.email)
        assert send_confirm_email.call_args.args[0] == self.user
        assert send_confirm_email.call_args.args[1] == self.email
        assert len(send_confirm_email.call_args.args[2]) == 32

    # TODO
    # def test_verify_new_identity(self):
