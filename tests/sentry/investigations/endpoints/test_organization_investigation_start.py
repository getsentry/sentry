from __future__ import annotations

from unittest import mock

import orjson
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from drf_spectacular.settings import patched_settings
from openapi_schema_validator import OAS30Validator
from sentry_protos.taskbroker.v1.taskbroker_pb2 import TaskActivation
from urllib3.response import HTTPResponse

import sentry.apidocs.extensions  # noqa: F401
from sentry.apidocs.hooks import CustomGenerator
from sentry.investigations.apidocs import PRIVATE_SCHEMA_SETTINGS
from sentry.investigations.contracts import OrchestrationProjectionSerializer
from sentry.investigations.models import InvestigationOrchestrationRun
from sentry.models.orgauthtoken import OrgAuthToken
from sentry.notebooks.models import Notebook
from sentry.silo.base import SiloMode
from sentry.tasks.seer.investigation import dispatch_investigation_orchestration_create
from sentry.taskworker.adapters import ViewerContextHook
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.silo import assume_test_silo_mode
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token
from sentry.viewer_context import Actor, ActorType, ViewerContext, decode_viewer_context

FEATURE = "organizations:investigations"


@with_feature(FEATURE)
class OrganizationInvestigationStartTest(APITestCase):
    start_route = "sentry-api-0-organization-investigations"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.start_url = reverse(
            self.start_route,
            kwargs={"organization_id_or_slug": self.organization.slug},
        )

    def orchestration_url(self, investigation_id: str) -> str:
        return reverse(
            "sentry-api-0-organization-investigation-orchestration",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "notebook_id": investigation_id,
            },
        )

    def test_requires_a_source(self) -> None:
        response = self.client.post(self.start_url, data={"title": "No source"}, format="json")

        assert response.status_code == 400
        assert "source" in response.data
        assert not Notebook.objects.filter(title="No source").exists()

    @mock.patch("sentry.notebooks.telemetry.sentry_sdk.metrics.count")
    def test_records_a_started_investigation(self, metrics_count: mock.MagicMock) -> None:
        response = self.client.post(
            self.start_url,
            data={"source": {"type": "manual", "prompt": "Investigate latency"}},
            format="json",
        )

        assert response.status_code == 201, response.data
        metrics_count.assert_any_call(
            "investigations.started",
            1,
            attributes={"source_type": "manual", "template": "manual"},
        )

    def test_org_auth_token_cannot_start(self) -> None:
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

        response = self.client.post(
            self.start_url,
            data={"source": {"type": "manual", "prompt": "Investigate latency"}},
            format="json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        assert response.status_code == 403
        assert not InvestigationOrchestrationRun.objects.exists()

    def test_private_schema_matches_the_response(self) -> None:
        with patched_settings(PRIVATE_SCHEMA_SETTINGS):
            schema = CustomGenerator().get_schema(public=True)

        response = self.client.post(
            self.start_url, data={"source": {"type": "manual"}}, format="json"
        )

        assert response.status_code == 201, response.data
        response_schema = schema["paths"][
            "/api/0/organizations/{organization_id_or_slug}/investigations/"
        ]["post"]["responses"]["201"]["content"]["application/json"]["schema"]
        OAS30Validator({**response_schema, "components": schema["components"]}).validate(
            orjson.loads(response.content)
        )

    def test_create_agentic_manual_investigation_awaiting_a_prompt(self) -> None:
        response = self.client.post(
            self.start_url,
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
            self.start_url,
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
                self.start_url,
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
            self.start_url,
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
            actor=Actor(type=ActorType.USER, actor_id=self.user.id),
            organization_id=self.organization.id,
        )
        synchronize_projection.assert_called_once()
        dispatch_commands.assert_called_once_with(run.id)

    def test_agentic_creation_rejects_an_inaccessible_project_atomically(self) -> None:
        foreign_project = self.create_project(organization=self.create_organization())

        response = self.client.post(
            self.start_url,
            data={
                "source": {"type": "manual", "prompt": "Investigate latency"},
                "projectIds": [foreign_project.id],
            },
            format="json",
        )

        assert response.status_code == 400
        assert response.data == {"detail": "One or more projects are inaccessible."}
        assert not InvestigationOrchestrationRun.objects.exists()

    def test_template_creation_is_rejected(self) -> None:
        before = Notebook.objects.count()
        response = self.client.post(
            self.start_url,
            data={
                "templateKey": "breached_metric",
                "templateVersion": 1,
                "source": {
                    "type": "metric_open_period",
                    "ref": {"groupId": "1", "openPeriodId": "1"},
                },
            },
            format="json",
        )
        assert response.status_code == 400
        assert Notebook.objects.count() == before

    def test_metric_source_rejects_wrong_issue_category(self) -> None:
        group = self.create_group(project=self.project)
        response = self.client.post(
            self.start_url,
            data={
                "source": {
                    "type": "metric_open_period",
                    "ref": {"groupId": str(group.id), "openPeriodId": "1"},
                },
            },
            format="json",
        )
        assert response.status_code == 404

    def test_private_schema_matches_a_populated_orchestration_projection(self) -> None:
        with patched_settings(PRIVATE_SCHEMA_SETTINGS):
            schema = CustomGenerator().get_schema(public=True)
        path = (
            "/api/0/organizations/{organization_id_or_slug}/investigations/"
            "{notebook_id}/orchestration/"
        )
        agentic = self.client.post(
            self.start_url, data={"source": {"type": "manual"}}, format="json"
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
        thought = {
            "id": "thought-1",
            "text": "Check the spans first.",
            "beforeActivityId": "tool-1",
        }
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
                    "thoughts": [thought],
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
                        "thoughts": [thought],
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
                    "currentBlockThoughts": [thought],
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

        response = self.client.get(self.orchestration_url(investigation_id))

        assert response.status_code == 200, response.data
        response_schema = schema["paths"][path]["get"]["responses"]["200"]["content"][
            "application/json"
        ]["schema"]
        OAS30Validator({**response_schema, "components": schema["components"]}).validate(
            orjson.loads(response.content)
        )
