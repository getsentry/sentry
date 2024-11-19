import pytest
from jsonschema import ValidationError

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import Workflow


class IssueAlertWorkflow(Workflow):
    class Meta:
        # These are added to make the tests work as expected
        app_label = "workflow_engine"
        managed = False

        # This will be needed in sub-classes
        proxy = True

    # Define a JSON Schema for the test
    CONFIG_SCHEMA = {
        "type": "object",
        "properties": {
            "frequency": {"type": "number"},
        },
        "required": ["frequency"],
    }


class WorkflowTest(TestCase):
    def setUp(self):
        self.org = self.create_organization()

    def tearDown(self):
        self.org.delete()

    def test_create_simple_workflow(self):
        workflow = Workflow.objects.create(name="test_workflow", organization=self.org)

        workflow.save()
        workflow.refresh_from_db()

        assert workflow.name == "test_workflow"
        assert workflow.organization == self.org

    def test_create_workflow_with_config__valid(self):
        workflow = IssueAlertWorkflow(
            name="test_workflow", organization=self.org, config={"frequency": 1}
        )

        assert workflow.config == {"frequency": 1}
        assert workflow.validate_config() is None

    def test_create_workflow_with_config__invalid(self):
        workflow = IssueAlertWorkflow(
            name="test_workflow", organization=self.org, config={"freq": 2}
        )

        assert workflow.config == {"freq": 2}
        with pytest.raises(ValidationError):
            assert workflow.validate_config()
