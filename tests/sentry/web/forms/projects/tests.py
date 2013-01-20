from django.contrib.auth.models import User
from sentry.web.forms.projects import RemoveProjectForm
from sentry.testutils import TestCase


class RemoveProjectFormTest(TestCase):
    def test_removes_password_on_empty_password_types(self):
        user = User(password='!')
        form = RemoveProjectForm(user=user, project_list=[])
        self.assertNotIn('password', form.fields)

    def test_requires_password_on_valid_accounts(self):
        user = User()
        user.set_password('foo')
        form = RemoveProjectForm(user=user, project_list=[])
        self.assertIn('password', form.fields)
