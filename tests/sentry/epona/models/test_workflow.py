from sentry.epona.models.workflow import Workflow
from sentry.testutils.cases import TestCase


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
