from __future__ import annotations

from sentry.issues.action_log.types import ActionSource, ImpactAssessmentAction
from sentry.issues.impact.delivery import deliver_impact_assessment
from sentry.issues.impact.types import IMPACT_FEATURE_ID
from sentry.issues.models.groupactionlogentry import GroupActionLogEntry
from sentry.seer.agent.feature_delivery import DELIVERY_HANDLERS
from sentry.testutils.cases import TestCase
from sentry.testutils.outbox import outbox_runner


class DeliverImpactAssessmentTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)
        run = self.create_seer_run(organization=self.organization, type="feature_run")
        self.agent_run = self.create_seer_agent_run(
            run=run,
            source=IMPACT_FEATURE_ID,
            group=self.group,
            project=self.project,
            extras={
                "source_event_id": "a" * 32,
                "available_citation_references": [f"entire-event:{'a' * 32}"],
            },
        )

    def test_registers_delivery_handler(self) -> None:
        assert DELIVERY_HANDLERS[IMPACT_FEATURE_ID] is deliver_impact_assessment

    def test_publishes_assessment(self) -> None:
        with self.feature("projects:issue-action-log-write-to-db"), outbox_runner():
            deliver_impact_assessment(
                organization_id=self.organization.id,
                run_uuid=self.agent_run.run.uuid,
                status="completed",
                result={
                    "score": 75,
                    "description": "Users cannot submit an order.",
                    "citations": [
                        {
                            "source": "event",
                            "reference": f"entire-event:{'a' * 32}",
                            "claim": "The request failed before order creation.",
                        }
                    ],
                },
                error=None,
            )

        entry = GroupActionLogEntry.objects.get(
            group_id=self.group.id, type=ImpactAssessmentAction.get_type()
        )
        assert entry.source == ActionSource.SEER_EXPLORER
        action = entry.action
        assert isinstance(action, ImpactAssessmentAction)
        assert action.score == 75
        assert action.description == "Users cannot submit an order."
        assert action.citations[0].source == "event"
        assert action.citations[0].reference == f"entire-event:{'a' * 32}"
        assert action.citations[0].claim == "The request failed before order creation."

    def test_completed_delivery_is_idempotent(self) -> None:
        for _ in range(2):
            with self.feature("projects:issue-action-log-write-to-db"), outbox_runner():
                deliver_impact_assessment(
                    organization_id=self.organization.id,
                    run_uuid=self.agent_run.run.uuid,
                    status="completed",
                    result={
                        "score": 50,
                        "description": "Monitor details are unavailable.",
                        "citations": [
                            {
                                "source": "event",
                                "reference": f"entire-event:{'a' * 32}",
                                "claim": "The monitor details operation failed.",
                            }
                        ],
                    },
                    error=None,
                )

        assert (
            GroupActionLogEntry.objects.filter(
                group_id=self.group.id,
                type=ImpactAssessmentAction.get_type(),
            ).count()
            == 1
        )

    def test_unavailable_citation_is_not_published(self) -> None:
        with self.feature("projects:issue-action-log-write-to-db"), outbox_runner():
            deliver_impact_assessment(
                organization_id=self.organization.id,
                run_uuid=self.agent_run.run.uuid,
                status="completed",
                result={
                    "score": 50,
                    "description": "Monitor details are unavailable.",
                    "citations": [
                        {
                            "source": "trace",
                            "reference": "trace:invented",
                            "claim": "An invented trace failed.",
                        }
                    ],
                },
                error=None,
            )

        assert not GroupActionLogEntry.objects.filter(group_id=self.group.id).exists()

    def test_failed_delivery_does_not_mutate_run(self) -> None:
        original_extras = self.agent_run.extras
        deliver_impact_assessment(
            organization_id=self.organization.id,
            run_uuid=self.agent_run.run.uuid,
            status="error",
            result=None,
            error="agent failed",
        )

        self.agent_run.refresh_from_db()
        assert self.agent_run.extras == original_extras
