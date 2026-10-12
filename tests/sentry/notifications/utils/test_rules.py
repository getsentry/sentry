from sentry.models.rule import Rule
from sentry.notifications.utils.rules import get_notification_origins, get_rule_or_workflow_id
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.models import Workflow


def _rule(action: dict[str, str]) -> Rule:
    return Rule(id=99, data={"actions": [action]})


def test_get_rule_or_workflow_id_prefers_legacy_rule_id_by_default() -> None:
    rule = _rule({"legacy_rule_id": "1", "workflow_id": "2"})
    assert get_rule_or_workflow_id(rule) == ("legacy_rule_id", "1")


def test_get_rule_or_workflow_id_prefer_workflow() -> None:
    rule = _rule({"legacy_rule_id": "1", "workflow_id": "2"})
    assert get_rule_or_workflow_id(rule, prefer="workflow_id") == ("workflow_id", "2")


def test_get_rule_or_workflow_id_falls_back_to_available_id() -> None:
    assert get_rule_or_workflow_id(_rule({"legacy_rule_id": "1"}), prefer="workflow_id") == (
        "legacy_rule_id",
        "1",
    )
    assert get_rule_or_workflow_id(_rule({"workflow_id": "2"})) == ("workflow_id", "2")


def test_get_rule_or_workflow_id_falls_back_to_rule_id() -> None:
    assert get_rule_or_workflow_id(_rule({}), prefer="workflow_id") == ("legacy_rule_id", "99")


class GetNotificationOriginsTest(TestCase):
    def test_resolves_workflow_with_legacy_identity(self) -> None:
        environment = self.create_environment(project=self.project)
        rule = self.create_project_rule(project=self.project)
        workflow_id = int(rule.data["actions"][0]["workflow_id"])
        Workflow.objects.filter(id=workflow_id).update(environment_id=environment.id)

        origins = get_notification_origins(self.project, workflow_ids=[workflow_id])

        assert len(origins) == 1
        assert origins[0].workflow_id == workflow_id
        assert origins[0].legacy_rule_id == rule.id
        assert origins[0].environment_id == environment.id

    def test_maps_legacy_identity_to_workflow(self) -> None:
        rule = self.create_project_rule(project=self.project)
        workflow_id = int(rule.data["actions"][0]["workflow_id"])

        origins = get_notification_origins(self.project, legacy_rule_ids=[rule.id])

        assert len(origins) == 1
        assert origins[0].workflow_id == workflow_id
        assert origins[0].legacy_rule_id == rule.id

    def test_deduplicates_dual_identity(self) -> None:
        rule = self.create_project_rule(project=self.project)
        workflow_id = int(rule.data["actions"][0]["workflow_id"])

        origins = get_notification_origins(
            self.project, workflow_ids=[workflow_id], legacy_rule_ids=[rule.id]
        )

        assert len(origins) == 1
