from __future__ import annotations

from django.urls import reverse

from sentry.investigations.models import InvestigationOrchestrationRun
from sentry.notebooks.models import (
    NotebookBlock,
    NotebookBlockExecutionStatus,
    NotebookBlockExecutor,
)
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationsDuplicateTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def test_duplicate_copies_notebook_structure_without_collaboration_or_execution(self) -> None:
        source = self.create_notebook(
            organization=self.organization,
            created_by=self.user,
            title="Original",
            filters={"environments": ["production"]},
        )
        first = self.create_notebook_block(
            notebook=source,
            position=0,
            kind="text",
            content="Hypothesis",
        )
        second = self.create_notebook_block(
            notebook=source,
            position=1,
            kind="query",
            content="count errors",
            display={"type": "table"},
        )
        execution = self.create_notebook_block_execution(
            block=second,
            executor=NotebookBlockExecutor.CODE_MODE,
            status=NotebookBlockExecutionStatus.COMPLETED,
            block_version=1,
            input_fingerprint="b" * 64,
            result={"columns": ["count"], "rows": [[1]]},
        )
        second.current_execution = execution
        second.save(update_fields=["current_execution"])
        seer_run = self.create_seer_run(organization=self.organization, seer_run_state_id=4815)
        self.create_investigation_orchestration_run(
            investigation=source, seer_run=seer_run, source={"type": "manual"}
        )
        first.update(
            producer_revision=1,
            producer_key="summary",
            producing_seer_run_id=seer_run.seer_run_state_id,
        )
        duplicate_url = reverse(
            "sentry-api-0-organization-notebook-duplicate",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": source.id,
            },
        )

        response = self.client.post(duplicate_url)

        assert response.status_code == 201, response.data
        assert response.data["title"] == "Copy of Original"
        assert response.data["createdBy"] == str(self.user.id)
        assert [block["content"] for block in response.data["blocks"]] == [
            "Hypothesis",
            "count errors",
        ]
        assert all(block["outputStatus"] == "notRun" for block in response.data["blocks"])
        assert not InvestigationOrchestrationRun.objects.filter(
            investigation_id=response.data["id"]
        ).exists()
        copied_first = NotebookBlock.objects.get(id=response.data["blocks"][0]["id"])
        assert copied_first.producer_revision is None
        assert copied_first.producer_key is None
        assert copied_first.producing_seer_run_id is None
