from sentry.models.projecttemplate import ProjectTemplate
from sentry.testutils.cases import TestCase


class ProjectTemplateTest(TestCase):
    def setUp(self):
        self.org = self.create_organization()

    def tearDown(self):
        self.org.delete()

    def test_create_simple_project_template(self):
        project_template = ProjectTemplate.objects.create(
            name="test_project_template", organization=self.org
        )

        project_template.save()
        project_template.refresh_from_db()

        assert project_template.name == "test_project_template"
        assert project_template.organization == self.org
