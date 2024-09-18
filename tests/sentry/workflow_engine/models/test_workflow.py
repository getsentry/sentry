from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models.workflow import Workflow


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
