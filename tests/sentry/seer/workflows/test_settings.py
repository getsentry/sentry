import pytest
from jsonschema import ValidationError

from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import Workflow


class SeerInvestigationWorkflowSettingsTest(TestCase):
    def create_seer_workflow(self, config: dict[str, object]) -> Workflow:
        return self.create_workflow(
            organization=self.organization, type=Workflow.Type.SEER_INVESTIGATION, config=config
        )

    def test_accepts_a_cron(self) -> None:
        config = {"frequency": 0, "crons": ["0 9 * * 1-5"], "timezone": "America/New_York"}
        workflow = self.create_seer_workflow(config)

        workflow.refresh_from_db()
        assert workflow.config == config

    def test_rejects_more_than_one_cron(self) -> None:
        with pytest.raises(ValidationError):
            self.create_seer_workflow({"crons": ["0 1 * * 1", "11 3 * * 4"]})

    def test_rejects_unknown_keys(self) -> None:
        with pytest.raises(ValidationError):
            self.create_seer_workflow({"prompt": "Investigate"})

    def test_rejects_a_timezone_without_a_cron(self) -> None:
        with pytest.raises(ValidationError):
            self.create_seer_workflow({"timezone": "UTC"})
