from sentry.models.options.project_template_option import ProjectTemplateOption
from sentry.models.projecttemplate import ProjectTemplate
from sentry.testutils.cases import TestCase


class ProjectTemplateOptionManagerTest(TestCase):
    def setUp(self):
        self.org = self.create_organization()

        self.project_template = ProjectTemplate.objects.create(
            name="test_project_template", organization=self.org
        )

    def test_set_value(self):
        ProjectTemplateOption.objects.set_value(self.project_template, "foo", "bar")
        assert (
            ProjectTemplateOption.objects.get(
                project_template=self.project_template, key="foo"
            ).value
            == "bar"
        )

    def test_get_value(self):
        result = ProjectTemplateOption.objects.get_value(self.project_template, "foo")
        assert result is None

        ProjectTemplateOption.objects.create(
            project_template=self.project_template, key="foo", value="bar"
        )

        result = ProjectTemplateOption.objects.get_value(self.project_template, "foo")
        assert result == "bar"

    def test_get_value_validated(self):
        result = ProjectTemplateOption.objects.get_value(self.project_template, "foo")
        assert result is None

        ProjectTemplateOption.objects.create(
            project_template=self.project_template, key="foo", value="bar"
        )

        # Test validator true
        result = ProjectTemplateOption.objects.get_value(
            self.project_template, "foo", None, lambda x: x == "bar"
        )
        assert result == "bar"

        # Test validator false
        result = ProjectTemplateOption.objects.get_value(
            self.project_template, "foo", None, lambda x: x != "bar"
        )
        assert result is None

    def test_unset_value(self):
        ProjectTemplateOption.objects.create(
            project_template=self.project_template, key="foo", value="bar"
        )
        ProjectTemplateOption.objects.unset_value(self.project_template, "foo")
        assert not ProjectTemplateOption.objects.filter(
            project_template=self.project_template, key="foo"
        ).exists()

    def test_get_value_bulk(self):
        result = ProjectTemplateOption.objects.get_value_bulk([self.project_template], "foo")
        assert result == {}

        ProjectTemplateOption.objects.create(
            project_template=self.project_template, key="foo", value="bar"
        )
        result = ProjectTemplateOption.objects.get_value_bulk([self.project_template], "foo")
        assert result == {self.project_template: "bar"}

    def test_get_value_actually_bulk(self):
        second_template = ProjectTemplate.objects.create(
            name="second_test_project_template", organization=self.org
        )

        result = ProjectTemplateOption.objects.get_value_bulk(
            [self.project_template, second_template], "foo"
        )
        assert result == {}

        ProjectTemplateOption.objects.create(
            project_template=self.project_template, key="foo", value="bar"
        )
        ProjectTemplateOption.objects.create(
            project_template=second_template, key="foo", value="baz"
        )
        result = ProjectTemplateOption.objects.get_value_bulk(
            [self.project_template, second_template], "foo"
        )
        assert result == {self.project_template: "bar", second_template: "baz"}

    def test_update_value(self):
        result = ProjectTemplateOption.objects.create(
            project_template=self.project_template, key="foo", value="bar"
        )
        assert result.value == "bar"

        ProjectTemplateOption.objects.set_value(self.project_template, key="foo", value="baz")
        result = ProjectTemplateOption.objects.get(
            project_template=self.project_template, key="foo"
        )
        assert result.value == "baz"

    def test_get_all_values(self):
        ProjectTemplateOption.objects.create(
            project_template=self.project_template, key="foo", value="bar"
        )

        result = ProjectTemplateOption.objects.get_all_values(self.project_template)
        assert result == {"foo": "bar"}

    def test_get_all_values_id(self):
        ProjectTemplateOption.objects.create(
            project_template=self.project_template, key="foo", value="bar"
        )

        result = ProjectTemplateOption.objects.get_all_values(self.project_template.id)
        assert result == {"foo": "bar"}

    def test_get_all_values_without_cache(self):
        ProjectTemplateOption.objects.create(
            project_template=self.project_template, key="foo", value="bar"
        )

        ProjectTemplateOption.objects._option_cache.clear()

        result = ProjectTemplateOption.objects.get_all_values(self.project_template.id)
        assert result == {"foo": "bar"}


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
