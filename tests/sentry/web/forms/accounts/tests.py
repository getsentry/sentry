from sentry.models import User
from sentry.testutils import TestCase
from sentry.web.forms.accounts import AccountSettingsForm


class AccountSettingsFormTest(TestCase):
    def test_removes_password_on_empty_password_types(self):
        user = User(password='!')
        form = AccountSettingsForm(user=user)
        self.assertNotIn('old_password', form.fields)

    def test_requires_password_on_valid_accounts(self):
        user = User()
        user.set_password('foo')
        form = AccountSettingsForm(user=user)
        self.assertIn('old_password', form.fields)
