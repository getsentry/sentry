from sentry.models import User, Project
from sentry.web.forms.projects import RemoveProjectForm, ProjectQuotasForm
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


class ProjectQuotasFormTest(TestCase):
    def test_accepts_percentage(self):
        project = Project(id=1)
        form = ProjectQuotasForm(project, {'per_minute': '50%'})
        assert form.is_valid()
        assert form.cleaned_data['per_minute'] == '50%'

    def test_invalidates_101_percent(self):
        project = Project(id=1)
        form = ProjectQuotasForm(project, {'per_minute': '101%'})
        assert not form.is_valid()
        assert 'per_minute' in form.errors

    def test_accepts_numbers(self):
        project = Project(id=1)
        form = ProjectQuotasForm(project, {'per_minute': '100'})
        assert form.is_valid()
        assert form.cleaned_data['per_minute'] == '100'

    def test_discards_0_percent(self):
        project = Project(id=1)
        form = ProjectQuotasForm(project, {'per_minute': '0%'})
        assert form.is_valid()
        assert form.cleaned_data['per_minute'] == '0'
