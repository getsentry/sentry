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


FRAME = {
    "id": "c_frame001",
    "kind": "event",
    "title": "submitOrder in checkout.ts:88",
    "locator": {
        "eventId": "a" * 32,
        "focus": {"type": "frame", "exceptionIndex": 0, "frameIndex": 2},
    },
}
USERS = {
    "id": "c_users001",
    "kind": "issue",
    "title": "SHOP-1: 903 users",
    "locator": {"groupId": "123", "stat": {"name": "users", "value": 903}},
}


class DeliverTypedCitationImpactAssessmentTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)
        run = self.create_seer_run(organization=self.organization, type="feature_run")
        self.agent_run = self.create_seer_agent_run(
            run=run,
            source=IMPACT_FEATURE_ID,
            group=self.group,
            project=self.project,
            extras={"source_event_id": "a" * 32, "citation_contract_version": 2},
        )

    def deliver(self, result: dict[str, object]) -> GroupActionLogEntry | None:
        with self.feature("projects:issue-action-log-write-to-db"), outbox_runner():
            deliver_impact_assessment(
                organization_id=self.organization.id,
                run_uuid=self.agent_run.run.uuid,
                status="completed",
                result=result,
                error=None,
            )
        return GroupActionLogEntry.objects.filter(
            group_id=self.group.id, type=ImpactAssessmentAction.get_type()
        ).first()

    def test_publishes_claims_with_evidence(self) -> None:
        other_org_project = self.create_project(organization=self.create_organization())
        foreign = {
            **FRAME,
            "id": "c_foreign01",
            "projectId": str(other_org_project.id),
        }
        entry = self.deliver(
            {
                "score": 70,
                "description": "Users cannot complete checkout.",
                "claims": [
                    {"claim": "Checkout crashes on submit.", "citationIds": [FRAME["id"]]},
                    {"claim": "903 users hit it.", "citationIds": [USERS["id"], "c_missing01"]},
                    {"claim": "Leaks across orgs.", "citationIds": [foreign["id"]]},
                ],
                "citations": [FRAME, USERS, foreign, {"id": "junk"}],
            }
        )

        assert entry is not None
        action = entry.action
        assert isinstance(action, ImpactAssessmentAction)
        assert [(c.claim, c.citation_ids) for c in action.claims] == [
            ("Checkout crashes on submit.", [FRAME["id"]]),
            ("903 users hit it.", [USERS["id"]]),
        ]
        assert [c.to_api() for c in action.evidence] == [FRAME, USERS]
        # Older clients read `citations`; each claim maps to its first citation.
        assert [(c.reference, c.source, c.claim) for c in action.citations] == [
            (FRAME["id"], "event", "Checkout crashes on submit."),
            (USERS["id"], "issue", "903 users hit it."),
        ]

    def test_drops_assessment_without_backed_claims(self) -> None:
        assert (
            self.deliver(
                {
                    "score": 70,
                    "description": "Unknown.",
                    "claims": [{"claim": "Made up.", "citationIds": ["c_missing01"]}],
                    "citations": [],
                }
            )
            is None
        )
