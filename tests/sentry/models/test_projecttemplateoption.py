from sentry.models.options.project_template_option import ProjectTemplateOption
from sentry.models.projecttemplate import ProjectTemplate
from sentry.testutils.cases import TestCase


class ProjectTemplateOptionTest(TestCase):
    def setUp(self):
        self.org = self.create_organization()

        self.project_template = ProjectTemplate.objects.create(
            name="test_project_template", organization=self.org
        )

    def tearDown(self):
        self.org.delete()
        self.project_template.delete()

    def test_create_simple_project_template(self):
        template_option = ProjectTemplateOption.objects.create(
            project_template=self.project_template,
            key="key",
            value="value",
        )

        template_option.save()
        template_option.refresh_from_db()

        assert template_option.key == "key"
        assert template_option.value == "value"
        assert template_option.project_template_id == self.project_template.id
