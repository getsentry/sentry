from __future__ import annotations

from unittest import mock

import orjson
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from drf_spectacular.settings import patched_settings
from openapi_schema_validator import OAS30Validator
from rest_framework.response import Response
from sentry_protos.taskbroker.v1.taskbroker_pb2 import TaskActivation
from urllib3.response import HTTPResponse

import sentry.apidocs.extensions  # noqa: F401
from sentry.apidocs.hooks import CustomGenerator
from sentry.investigations.apidocs import PRIVATE_SCHEMA_SETTINGS
from sentry.investigations.contracts import OrchestrationProjectionSerializer
from sentry.investigations.models import (
    Investigation,
    InvestigationOrchestrationRun,
    InvestigationSourceType,
    InvestigationStatus,
)
from sentry.investigations.templates.types import (
    InvestigationTemplateSpec,
    TemplateBlockSpec,
)
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.silo.base import SiloMode
from sentry.tasks.seer.investigation import dispatch_investigation_orchestration_create
from sentry.taskworker.adapters import ViewerContextHook
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token
from sentry.viewer_context import ActorType, ViewerContext, decode_viewer_context

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationIndexTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.collection_url = reverse(
            "sentry-api-0-organization-investigations",
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    @mock.patch("sentry.investigations.telemetry.sentry_sdk.metrics.count")
    def test_create_manual_and_list(self, metrics_count: mock.MagicMock) -> None:
        response = self.client.post(
            self.collection_url,
            data={
                "title": "Checkout follow-up",
                "projectIds": [self.project.id],
                "filters": {"environment": ["production"]},
            },
            format="json",
        )
        assert response.status_code == 201, response.data
        assert response.data["title"] == "Checkout follow-up"
        assert response.data["projectIds"] == [self.project.id]
        assert response.data["blocks"] == []
        metrics_count.assert_any_call(
            "investigations.started",
            1,
            attributes={"source_type": "manual", "template": "manual"},
        )

        response = self.client.get(self.collection_url)
        assert response.status_code == 200
        assert [item["title"] for item in response.data] == ["Checkout follow-up"]
        assert response.data[0]["blockCount"] == 0
        assert response.data[0]["isFavorited"] is False

    def test_create_agentic_manual_investigation_awaiting_a_prompt(self) -> None:
        response = self.client.post(
            self.collection_url,
            data={
                "title": "Checkout investigation",
                "source": {"type": "manual", "seed": {"release": "example-release"}},
                "projectIds": [self.project.id],
                "filters": {"environment": ["production"]},
            },
            format="json",
        )

        assert response.status_code == 201, response.data
        assert "mode" not in response.data
        assert response.data["orchestration"] == {
            "phase": "intake",
            "status": "awaiting_input",
            "heartbeatAt": None,
            "notebookRevision": 0,
        }
        run = InvestigationOrchestrationRun.objects.get(investigation_id=response.data["id"])
        assert run.source == {
            "type": "manual",
            "projectScope": {"type": "investigation"},
            "seed": {"release": "example-release"},
        }
        assert run.schema_version == 1
        assert run.workflow_version == 1
        assert run.generation == 1
        assert run.notebook_revision == 0
        assert run.projection["report"]["revision"] == 0
        assert run.projection["pendingInput"]["missingFields"] == ["prompt"]
        assert run.projection["broadScan"]["status"] == "blocked"

    def test_create_agentic_manual_investigation_without_a_time_range_starts_scan(self) -> None:
        response = self.client.post(
            self.collection_url,
            data={"source": {"type": "manual", "prompt": "Investigate checkout latency"}},
            format="json",
        )

        assert response.status_code == 201, response.data
        run = InvestigationOrchestrationRun.objects.get(investigation_id=response.data["id"])
        assert run.phase == "broad_scan"
        assert run.status == "pending"
        assert run.projection["pendingInput"] is None
        assert run.projection["broadScan"]["status"] == "queued"

    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_orchestration_create.delay")
    def test_agentic_creation_schedules_automatic_execution(self, dispatch: mock.Mock) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.collection_url,
                data={"source": {"type": "manual", "prompt": "Investigate latency"}},
                format="json",
            )

        assert response.status_code == 201, response.data
        run = InvestigationOrchestrationRun.objects.get(investigation_id=response.data["id"])
        dispatch.assert_called_once_with(run.id)

    @override_settings(
        SEER_API_SHARED_SECRET="viewer-context-test-secret",
        SENTRY_VIEWER_CONTEXT_ENABLED=True,
    )
    @mock.patch(
        "sentry.tasks.seer.investigation.dispatch_investigation_orchestration_commands.delay"
    )
    @mock.patch("sentry.tasks.seer.investigation.synchronize_orchestration_projection")
    @mock.patch("sentry.investigations.seer_client.investigation_connection_pool.urlopen")
    @mock.patch("sentry.investigations.services.orchestration.transaction.on_commit")
    @mock.patch("sentry.tasks.seer.investigation.dispatch_investigation_orchestration_create.delay")
    def test_agentic_creation_propagates_user_context_to_seer(
        self,
        dispatch: mock.Mock,
        on_commit: mock.Mock,
        mock_urlopen: mock.Mock,
        synchronize_projection: mock.Mock,
        dispatch_commands: mock.Mock,
    ) -> None:
        activations: list[TaskActivation] = []

        def capture_dispatch(run_id: int) -> None:
            activations.append(
                dispatch_investigation_orchestration_create.create_activation(
                    args=[run_id], kwargs={}
                )
            )

        dispatch.side_effect = capture_dispatch
        on_commit.side_effect = lambda callback, **kwargs: callback()

        response = self.client.post(
            self.collection_url,
            data={"source": {"type": "manual", "prompt": "Investigate latency"}},
            format="json",
        )

        assert response.status_code == 201, response.data
        assert len(activations) == 1
        run = InvestigationOrchestrationRun.objects.get(investigation_id=response.data["id"])
        mock_urlopen.return_value = HTTPResponse(
            orjson.dumps(
                {
                    "runId": 123,
                    "created": True,
                    "projection": {
                        **run.projection,
                        "heartbeatAt": timezone.now().isoformat(),
                    },
                }
            ),
            status=200,
        )

        with ViewerContextHook().on_execute(dict(activations[0].headers)):
            dispatch_investigation_orchestration_create(run.id)

        viewer_context = decode_viewer_context(
            mock_urlopen.call_args.kwargs["headers"]["X-Viewer-Context"],
            key="viewer-context-test-secret",
        )
        assert viewer_context == ViewerContext(
            organization_id=self.organization.id,
            user_id=self.user.id,
            actor_type=ActorType.USER,
        )
        synchronize_projection.assert_called_once()
        dispatch_commands.assert_called_once_with(run.id)

    def test_agentic_creation_rejects_an_inaccessible_project_atomically(self) -> None:
        foreign_project = self.create_project(organization=self.create_organization())

        response = self.client.post(
            self.collection_url,
            data={
                "source": {"type": "manual", "prompt": "Investigate latency"},
                "projectIds": [foreign_project.id],
            },
            format="json",
        )

        assert response.status_code == 400
        assert not InvestigationOrchestrationRun.objects.exists()

    def test_list_includes_summary_when_projects_are_accessible(self) -> None:
        investigation = self.create_investigation(
            organization=self.organization,
            created_by=self.user,
            title="Checkout errors",
            summary="Errors crossed alert threshold",
            summary_description="Checkout errors increased.\nReview the latest release.",
        )
        self.create_investigation_project(investigation=investigation, project=self.project)

        response = self.client.get(self.collection_url)

        assert response.status_code == 200
        listed = next(item for item in response.data if item["id"] == str(investigation.id))
        assert listed["summary"] == "Errors crossed alert threshold"
        assert listed["summaryDescription"] == (
            "Checkout errors increased.\nReview the latest release."
        )

    def test_list_includes_orchestration_state_only_for_agentic_investigations(self) -> None:
        heartbeat = timezone.now()
        agentic = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Agentic"
        )
        self.create_investigation_orchestration_run(
            investigation=agentic,
            phase="judging",
            status="processing",
            notebook_revision=2,
            heartbeat_at=heartbeat,
        )
        manual = self.create_investigation(
            organization=self.organization, created_by=self.user, title="Manual"
        )

        response = self.client.get(self.collection_url)

        assert response.status_code == 200
        listed = {item["id"]: item for item in response.data}
        assert listed[str(agentic.id)]["orchestration"] == {
            "phase": "judging",
            "status": "processing",
            "heartbeatAt": heartbeat,
            "notebookRevision": 2,
        }
        assert listed[str(manual.id)]["orchestration"] is None

    def test_regular_member_can_create_an_investigation(self) -> None:
        member_user = self.create_user()
        self.create_member(
            organization=self.organization, user=member_user, role="member", teams=[]
        )
        self.login_as(member_user)

        response = self.client.post(
            self.collection_url,
            data={"title": "Created by member", "projectIds": [self.project.id]},
            format="json",
        )

        assert response.status_code == 201, response.data
        assert response.data["createdBy"] == str(member_user.id)
        assert response.data["projectIds"] == [self.project.id]

    def test_manual_creation_rejects_inaccessible_project(self) -> None:
        other_organization = self.create_organization()
        other_project = self.create_project(organization=other_organization)
        response = self.client.post(
            self.collection_url,
            data={"title": "No access", "projectIds": [other_project.id]},
            format="json",
        )
        assert response.status_code == 400
        assert not Investigation.objects.filter(title="No access").exists()

    def test_template_validation_is_strict_and_atomic(self) -> None:
        before = Investigation.objects.count()
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "source": {
                    "type": "metric_open_period",
                    "ref": {"groupId": "1", "openPeriodId": "1"},
                },
                "parameters": {"unexpected": True},
            },
            format="json",
        )
        assert response.status_code == 400
        assert "parameters" in response.data
        assert Investigation.objects.count() == before

    def test_unknown_template_version_is_atomic(self) -> None:
        before = Investigation.objects.count()
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 999,
                "source": {
                    "type": "metric_open_period",
                    "ref": {"groupId": "1", "openPeriodId": "1"},
                },
                "parameters": {},
            },
            format="json",
        )
        assert response.status_code == 400
        assert Investigation.objects.count() == before

    def test_cyclic_template_rolls_back_before_source_resolution(self) -> None:
        template = InvestigationTemplateSpec(
            key="cyclic",
            version=1,
            source_type=InvestigationSourceType.METRIC_OPEN_PERIOD,
            parameters=(),
            blocks=(
                TemplateBlockSpec(key="one", kind="text", title="One", dependencies=("two",)),
                TemplateBlockSpec(key="two", kind="text", title="Two", dependencies=("one",)),
            ),
        )
        before = Investigation.objects.count()
        with mock.patch(
            "sentry.investigations.services.investigations.get_investigation_template",
            return_value=template,
        ):
            response = self.client.post(
                self.collection_url,
                data={
                    "templateKey": "cyclic",
                    "templateVersion": 1,
                    "source": {"type": "metric_open_period", "ref": {"groupId": "1"}},
                    "parameters": {},
                },
                format="json",
            )
        assert response.status_code == 400
        assert Investigation.objects.count() == before

    def test_template_rejects_wrong_issue_category(self) -> None:
        group = self.create_group(project=self.project)
        response = self.client.post(
            self.collection_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "source": {
                    "type": "metric_open_period",
                    "ref": {"groupId": str(group.id), "openPeriodId": "1"},
                },
                "parameters": {},
            },
            format="json",
        )
        assert response.status_code == 404

    def test_source_lineage_lists_latest_and_keeps_historical_detail(self) -> None:
        lineage = {
            "organization": self.organization,
            "created_by": self.user,
            "source": {"type": "issue", "ref": {"groupId": "123"}},
            "source_type": "issue",
            "source_ref": {"groupId": "123"},
            "source_key": "issue:123",
            "lineage_key": "issue:123",
        }
        first = self.create_investigation(
            title="First revision",
            source_revision=1,
            status=InvestigationStatus.ARCHIVED,
            **lineage,
        )
        second = self.create_investigation(
            title="Second revision", source_revision=2, status=InvestigationStatus.ACTIVE, **lineage
        )

        response = self.client.get(self.collection_url)
        assert [item["id"] for item in response.data] == [str(second.id)]

        first_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": first.id,
            },
        )
        assert self.client.get(first_url).status_code == 200

        second_url = reverse(
            "sentry-api-0-organization-investigation-details",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "investigation_id": second.id,
            },
        )
        assert (
            self.client.delete(
                second_url,
                data={"investigationVersion": second.version},
                format="json",
            ).status_code
            == 204
        )
        assert not Investigation.objects.filter(
            lineage_key="issue:123", status=InvestigationStatus.ACTIVE
        ).exists()

        third = self.create_investigation(
            title="Third revision", source_revision=3, status=InvestigationStatus.ACTIVE, **lineage
        )
        response = self.client.get(self.collection_url)
        assert [item["id"] for item in response.data] == [str(third.id)]

    def test_legacy_only_lineage_lists_only_the_latest_revision(self) -> None:
        lineage = {
            "organization": self.organization,
            "created_by": self.user,
            "source_type": InvestigationSourceType.BREACHED_METRIC,
            "source_ref": {"groupId": "123", "openPeriodId": "456"},
            "source_key": "legacy-lineage",
            "status": InvestigationStatus.ARCHIVED,
        }
        self.create_investigation(title="First revision", source_revision=1, **lineage)
        second = self.create_investigation(title="Second revision", source_revision=2, **lineage)

        response = self.client.get(self.collection_url, {"status": "archived"})

        assert response.status_code == 200
        assert [item["id"] for item in response.data] == [str(second.id)]

    def test_org_auth_token_can_list_investigations(self) -> None:
        self.create_investigation(
            organization=self.organization, created_by=self.user, title="Listed"
        )
        token = generate_token(self.organization.slug, "")
        with assume_test_silo_mode(SiloMode.CONTROL):
            OrgAuthToken.objects.create(
                organization_id=self.organization.id,
                name="token",
                token_hashed=hash_token(token),
                token_last_characters=token[-4:],
                scope_list=["org:read"],
                date_last_used=None,
            )
            self.client.logout()

        response = self.client.get(self.collection_url, HTTP_AUTHORIZATION=f"Bearer {token}")

        assert response.status_code == 200, response.data
        assert [item["title"] for item in response.data] == ["Listed"]
        assert response.data[0]["isFavorited"] is False

    def test_private_schema_matches_frontend_responses(self) -> None:
        with patched_settings(PRIVATE_SCHEMA_SETTINGS):
            schema = CustomGenerator().get_schema(public=True)
        base = "/api/0/organizations/{organization_id_or_slug}/investigations/"
        detail_path = base + "{investigation_id}/"

        def validate_response(response: Response, method: str, path: str) -> None:
            assert 200 <= response.status_code < 300, response.data
            response_schema = schema["paths"][path][method]["responses"][str(response.status_code)][
                "content"
            ]["application/json"]["schema"]
            OAS30Validator({**response_schema, "components": schema["components"]}).validate(
                orjson.loads(response.content)
            )

        created = self.client.post(
            self.collection_url,
            data={"title": "Checkout latency", "projectIds": [self.project.id]},
            format="json",
        )
        validate_response(created, "post", base)
        validate_response(self.client.get(self.collection_url), "get", base)
        detail_url = f"{self.collection_url}{created.data['id']}/"
        block = self.client.post(
            detail_url + "blocks/",
            data={
                "investigationVersion": created.data["version"],
                "kind": "text",
                "content": "Initial observations",
            },
            format="json",
        )
        validate_response(block, "post", detail_path + "blocks/")
        detail = self.client.get(detail_url)
        validate_response(detail, "get", detail_path)
        comment = self.client.post(
            detail_url + "comments/",
            data={"body": "Latency rose after deployment.", "blockId": int(block.data["id"])},
            format="json",
        )
        validate_response(comment, "post", detail_path + "comments/")
        validate_response(
            self.client.get(detail_url + "comments/"), "get", detail_path + "comments/"
        )
        validate_response(
            self.client.get(detail_url + "comment-counts/"), "get", detail_path + "comment-counts/"
        )
        validate_response(
            self.client.put(detail_url + "presence/"), "put", detail_path + "presence/"
        )
        validate_response(
            self.client.get(detail_url + "title-generation/"),
            "get",
            detail_path + "title-generation/",
        )

        agentic = self.client.post(
            self.collection_url, data={"source": {"type": "manual"}}, format="json"
        )
        validate_response(agentic, "post", base)
        orchestration = self.client.get(f"{self.collection_url}{agentic.data['id']}/orchestration/")
        validate_response(orchestration, "get", detail_path + "orchestration/")

    def test_private_schema_matches_a_populated_orchestration_projection(self) -> None:
        with patched_settings(PRIVATE_SCHEMA_SETTINGS):
            schema = CustomGenerator().get_schema(public=True)
        path = (
            "/api/0/organizations/{organization_id_or_slug}/investigations/"
            "{investigation_id}/orchestration/"
        )
        agentic = self.client.post(
            self.collection_url, data={"source": {"type": "manual"}}, format="json"
        )
        investigation_id = agentic.data["id"]
        error = {
            "code": "tool_failed",
            "message": "The query timed out.",
            "retryable": True,
            "source": "investigator",
            "occurredAt": "2026-01-01T00:02:00+00:00",
        }
        tool = {"id": "tool-1", "title": "Query spans", "kind": "api", "status": "completed"}
        evidence = {
            "id": "evidence-1",
            "title": "Slow checkout spans",
            "kind": "query",
            "reference": "spans:checkout",
            "url": "https://example.com/explore/",
            "summary": "p95 doubled after the deploy.",
            "data": {"p95": 1.8},
            "projectIds": [self.project.id],
        }
        # Every optional nested object filled in, validated the way a Seer event is
        # before it is stored.
        validator = OrchestrationProjectionSerializer(
            data={
                "runId": 4815,
                "investigationId": str(investigation_id),
                "sourceType": "manual",
                "workflowVersion": 3,
                "generation": 1,
                "phase": "reporting",
                "status": "processing",
                "broadScan": {
                    "status": "completed",
                    "summary": "Checkout latency rose after a deploy.",
                    "heartbeatAt": "2026-01-01T00:01:00+00:00",
                    "error": None,
                    "toolActivity": [tool],
                    "generation": 1,
                    "attempt": 0,
                    "automaticRetryCount": 0,
                    "runId": 99,
                },
                "hypotheses": [
                    {
                        "id": "hypothesis-1",
                        "order": 0,
                        "statement": "The deploy slowed checkout",
                        "rationale": "Latency rose with the release.",
                        "status": "completed",
                        "effectiveStatus": "accepted",
                        "decisionSource": "user",
                        "confidence": 0.8,
                        "generation": 1,
                        "attempt": 0,
                        "automaticRetryCount": 0,
                        "investigatorRunId": 100,
                        "planningStatus": "completed",
                        "heartbeatAt": "2026-01-01T00:03:00+00:00",
                        "toolActivity": [tool],
                        "evidence": [evidence],
                        "verificationSteps": [
                            {
                                "id": "step-1",
                                "order": 0,
                                "title": "Compare releases",
                                "objective": "Find the affected release",
                                "method": "Break latency down by release",
                                "status": "completed",
                                "result": "Only the latest release is slow.",
                                "evidence": [evidence],
                                "error": None,
                            }
                        ],
                        "agentVerdict": {
                            "verdict": "supported",
                            "confidence": 0.8,
                            "rationale": "Every check points at the release.",
                            "supportingEvidenceIds": ["evidence-1"],
                            "refutingEvidenceIds": [],
                            "remainingGaps": ["Regional breakdown"],
                            "decidedAt": "2026-01-01T00:04:00+00:00",
                        },
                        "userDisposition": {
                            "disposition": "accepted",
                            "userId": self.user.id,
                            "decidedAt": "2026-01-01T00:05:00+00:00",
                        },
                        "error": error,
                    }
                ],
                "report": {
                    "status": "composing",
                    "revision": 1,
                    "notebookRevision": 2,
                    "includedHypothesisIds": ["hypothesis-1"],
                    "primaryHypothesisId": "hypothesis-1",
                    "currentBlockKey": "summary",
                    "currentBlockStatus": "running",
                    "currentBlockToolActivity": [tool],
                    "heartbeatAt": "2026-01-01T00:06:00+00:00",
                    "automaticRetryCount": 0,
                    "clearIntent": {
                        "id": "clear-1",
                        "revision": 1,
                        "reason": "Hypotheses changed",
                        "requestedAt": "2026-01-01T00:06:00+00:00",
                        "completed": False,
                    },
                    "metadata": {
                        "status": "completed",
                        "title": "Why checkout slowed",
                        "summary": "A deploy slowed checkout",
                        "summaryDescription": "Latency rose with the release.",
                        "titleStatus": "completed",
                        "automaticRetryCount": 0,
                        "error": None,
                    },
                    "suggestedHypotheses": [
                        {"statement": "A cache regressed", "rationale": "Misses rose too."}
                    ],
                    "error": None,
                },
                "pendingInput": {"prompt": "Which region?", "missingFields": ["prompt"]},
                "investigatorScheduling": {
                    "maxConcurrency": 2,
                    "availableSlots": 1,
                    "activeHypothesisIds": ["hypothesis-1"],
                    "queuedHypothesisIds": [],
                    "nextHypothesisIds": [],
                },
                "cancellationIntents": [
                    {
                        "id": "cancel-1",
                        "scope": "hypothesis",
                        "targetId": "hypothesis-2",
                        "childRunId": 101,
                        "generation": 1,
                        "reason": "Rejected by the user",
                        "requestedAt": "2026-01-01T00:07:00+00:00",
                        "completed": True,
                    }
                ],
                "steeringIntents": [
                    {
                        "id": "steer-1",
                        "requestId": "request-1",
                        "instruction": "Check the cache first",
                        "target": "workflow",
                        "targetId": None,
                        "createdAt": "2026-01-01T00:08:00+00:00",
                        "completed": False,
                    }
                ],
                "errors": [error],
                "heartbeatAt": "2026-01-01T00:09:00+00:00",
                "updatedAt": "2026-01-01T00:09:00+00:00",
                "startedAt": "2026-01-01T00:00:00+00:00",
                "finishedAt": None,
                "activeSince": "2026-01-01T00:00:00+00:00",
                "activeTimeElapsedSeconds": 540.0,
            }
        )
        validator.is_valid(raise_exception=True)
        run = InvestigationOrchestrationRun.objects.get(investigation_id=investigation_id)
        run.projection = validator.validated_data
        run.save()

        response = self.client.get(f"{self.collection_url}{investigation_id}/orchestration/")

        assert response.status_code == 200, response.data
        response_schema = schema["paths"][path]["get"]["responses"]["200"]["content"][
            "application/json"
        ]["schema"]
        OAS30Validator({**response_schema, "components": schema["components"]}).validate(
            orjson.loads(response.content)
        )
