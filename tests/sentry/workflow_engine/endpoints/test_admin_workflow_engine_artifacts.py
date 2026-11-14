from datetime import timedelta
from unittest.mock import patch
from uuid import UUID

from django.test import override_settings

from sentry.auth.superuser import MAX_AGE, MAX_AGE_PRIVILEGED_ORG_ACCESS, SESSION_KEY
from sentry.auth.system import SystemToken
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.impersonation import simulate_impersonation
from sentry.testutils.silo import cell_silo_test
from sentry.utils.snuba import SnubaError
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context
from sentry.workflow_engine.artifacts import ArtifactQueryResult
from sentry.workflow_engine.endpoints.admin_workflow_engine_artifacts import (
    AdminWorkflowEngineArtifactsEndpoint,
)
from sentry.workflow_engine.processors.evaluations.eap import EAP_RETENTION_DAYS

ENDPOINT_MODULE = "sentry.workflow_engine.endpoints.admin_workflow_engine_artifacts"
NOW = before_now(minutes=1).replace(microsecond=0)
EVENT_ID = "1234567890abcdef1234567890abcdef"
EMPTY_RESULT = ArtifactQueryResult(artifacts=[], truncated=False)


@cell_silo_test
@override_settings(SENTRY_SELF_HOSTED=True)
@freeze_time(NOW)
class AdminWorkflowEngineArtifactsTest(APITestCase):
    url = "/api/0/_admin/workflow-engine/artifacts/"

    def login_superuser(self):
        user = self.create_user(is_superuser=True, is_staff=False)
        self.login_as(user, superuser=True)
        return user

    def assert_denied_before_lookup(self, *, status_code=403, params=None, **headers):
        with (
            patch(f"{ENDPOINT_MODULE}.resolve_artifact_target") as resolve,
            patch(f"{ENDPOINT_MODULE}.query_artifacts") as query,
        ):
            response = self.client.get(
                self.url,
                params if params is not None else {"type": "workflow", "id": "1"},
                **headers,
            )
        assert response.status_code == status_code, response.content
        resolve.assert_not_called()
        query.assert_not_called()
        return response

    def test_ordinary_user_denied(self):
        self.login_as(self.user)
        self.assert_denied_before_lookup()

    def test_impersonation_rejected_even_if_target_is_elevated(self):
        self.login_superuser()
        with simulate_impersonation(self.create_user(is_superuser=True)):
            self.assert_denied_before_lookup()

    def test_authorization_header_with_valid_elevated_cookie_denied(self):
        user = self.login_superuser()
        token = self.create_user_auth_token(user, scope_list=["org:read", "event:read"])
        self.assert_denied_before_lookup(HTTP_AUTHORIZATION=f"Bearer {token.token}")

    @override_settings(SEER_API_SHARED_SECRET="artifacts-test-secret")
    def test_signed_viewer_context_denied_even_with_elevation(self):
        user = self.login_superuser()
        context = encode_viewer_context(
            ViewerContext(actor=Actor(type=ActorType.USER, actor_id=user.id)),
            key="artifacts-test-secret",
        )
        self.assert_denied_before_lookup(HTTP_X_VIEWER_CONTEXT=context)

    def test_internal_system_token_denied_before_lookup(self):
        request = self.make_request(
            user=self.create_user(is_superuser=True),
            auth=SystemToken(),
            path=self.url,
            GET={"type": "workflow", "id": "1"},
        )
        request.__from_api_client__ = True
        with (
            patch(f"{ENDPOINT_MODULE}.resolve_artifact_target") as resolve,
            patch(f"{ENDPOINT_MODULE}.query_artifacts") as query,
        ):
            response = AdminWorkflowEngineArtifactsEndpoint.as_view()(request)
        assert response.status_code == 403
        resolve.assert_not_called()
        query.assert_not_called()

    def test_invalid_input_rejected_before_lookup(self):
        self.login_superuser()
        for params in (
            {"type": "workflow", "id": "0"},
            {"type": "detector", "id": str(2**63)},
            {"type": "event", "id": "not-a-uuid", "projectId": "1"},
            {"type": "event", "id": EVENT_ID},
            {"type": "workflow", "id": "1", "projectId": "1"},
            {"type": "workflow", "id": "1", "statsPeriod": "8d"},
        ):
            self.assert_denied_before_lookup(status_code=400, params=params)

    def test_superuser_reads_another_organization(self):
        self.login_superuser()
        org = self.create_organization()
        project = self.create_project(organization=org)
        workflow = self.create_workflow(organization=org)
        with patch(f"{ENDPOINT_MODULE}.query_artifacts", return_value=EMPTY_RESULT) as query:
            response = self.client.get(self.url, {"type": "workflow", "id": f"00{workflow.id}"})
        assert response.status_code == 200, response.content
        assert response.data["item"]["type"] == "workflow"
        assert response.data["item"]["id"] == str(workflow.id)
        assert response.data["item"]["organizationId"] == str(org.id)
        assert response.data["item"]["data"]["id"] == str(workflow.id)
        assert response.data["item"]["data"]["name"] == workflow.name
        assert response.data["artifacts"] == []
        assert response.data["retentionDays"] == EAP_RETENTION_DAYS
        assert response.data["truncated"] is False
        assert response["Cache-Control"] == "no-store"
        assert query.call_args.args[0].project_ids == [project.id]

    def test_project_scoped_items_need_no_project_parameter(self):
        self.login_superuser()
        detector = self.create_detector(project=self.project)
        group = self.create_group(project=self.project)
        for item_type, item_id in (("detector", detector.id), ("group", group.id)):
            with patch(f"{ENDPOINT_MODULE}.query_artifacts", return_value=EMPTY_RESULT) as query:
                response = self.client.get(self.url, {"type": item_type, "id": str(item_id)})
            assert response.status_code == 200, response.content
            assert response.data["item"]["data"]["id"] == str(item_id)
            assert query.call_args.args[0].project_ids == [self.project.id]

    def test_event_id_and_project_are_normalized(self):
        self.login_superuser()
        event = self.store_event(
            data={"event_id": EVENT_ID, "message": "artifact event", "timestamp": NOW.timestamp()},
            project_id=self.project.id,
        )
        with (
            patch(
                "sentry.workflow_engine.artifacts.eventstore.backend.get_event_by_id",
                return_value=event,
            ) as get_event,
            patch(f"{ENDPOINT_MODULE}.query_artifacts", return_value=EMPTY_RESULT) as query,
        ):
            response = self.client.get(
                self.url,
                {
                    "type": "event",
                    "id": str(UUID(EVENT_ID)).upper(),
                    "projectId": f"0{self.project.id}",
                },
            )
        assert response.status_code == 200, response.content
        assert response.data["item"]["id"] == EVENT_ID
        assert response.data["item"]["data"]["eventID"] == EVENT_ID
        assert query.call_args.args[0].project_ids == [self.project.id]
        assert get_event.call_args.args[:2] == (self.project.id, EVENT_ID)
        assert get_event.call_args.kwargs["tenant_ids"] == {"organization_id": self.organization.id}

    def test_missing_event_project_is_not_found_before_eventstore_resolution(self):
        self.login_superuser()
        response = self.assert_denied_before_lookup(
            status_code=404,
            params={"type": "event", "id": EVENT_ID, "projectId": str(2**63 - 1)},
        )
        assert "item" not in response.data

    def test_missing_item_is_not_empty_history(self):
        self.login_superuser()
        with patch(f"{ENDPOINT_MODULE}.query_artifacts") as query:
            response = self.client.get(self.url, {"type": "workflow", "id": str(2**63 - 1)})
        assert response.status_code == 404, response.content
        query.assert_not_called()

    def test_time_window_is_bounded_and_reported(self):
        self.login_superuser()
        workflow = self.create_workflow()
        for period, duration in (
            ("1h", timedelta(hours=1)),
            ("24h", timedelta(days=1)),
            ("7d", timedelta(days=7)),
        ):
            with patch(
                f"{ENDPOINT_MODULE}.query_artifacts",
                return_value=ArtifactQueryResult(artifacts=[], truncated=True),
            ) as query:
                response = self.client.get(
                    self.url, {"type": "workflow", "id": str(workflow.id), "statsPeriod": period}
                )
            assert response.status_code == 200, response.content
            assert query.call_args.kwargs["start"] == NOW - duration
            assert query.call_args.kwargs["end"] == NOW
            assert response.data["start"] == (NOW - duration).isoformat()
            assert response.data["end"] == NOW.isoformat()
            assert response.data["truncated"] is True

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_data_secrecy_denies_before_serialization_and_artifact_query(self):
        self.login_superuser()
        org = self.create_organization()
        org.flags.prevent_superuser_access = True
        org.save()
        workflow = self.create_workflow(organization=org)
        with (
            self.feature("organizations:data-secrecy"),
            patch(f"{ENDPOINT_MODULE}.serialize") as serialize,
            patch(f"{ENDPOINT_MODULE}.query_artifacts") as query,
        ):
            response = self.client.get(self.url, {"type": "workflow", "id": str(workflow.id)})
        assert response.status_code == 401, response.content
        assert response.data["detail"]["code"] == "data-secrecy"
        serialize.assert_not_called()
        query.assert_not_called()

    def test_per_organization_authorization_allows_only_approved_org(self):
        self.login_superuser()
        approved = self.create_organization()
        other = self.create_organization()
        approved_workflow = self.create_workflow(organization=approved)
        other_workflow = self.create_workflow(organization=other)
        data = dict(self.session[SESSION_KEY])
        data["orgs"] = {approved.slug: {"cat": "for_unit_test", "reason": "debug workflow"}}
        self.session[SESSION_KEY] = data
        self.save_session()
        with (
            override_settings(
                SENTRY_SELF_HOSTED=False, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=True
            ),
            patch(f"{ENDPOINT_MODULE}.query_artifacts", return_value=EMPTY_RESULT) as query,
        ):
            response = self.client.get(
                self.url, {"type": "workflow", "id": str(approved_workflow.id)}
            )
            denied = self.client.get(self.url, {"type": "workflow", "id": str(other_workflow.id)})
        assert response.status_code == 200, response.content
        assert denied.status_code == 403, denied.content
        assert query.call_count == 1

    def test_cross_organization_expiry_is_rechecked_after_resolving_item(self):
        self.login_superuser()
        workflow = self.create_workflow(organization=self.create_organization())
        data = dict(self.session[SESSION_KEY])
        data["exp"] = str(
            int((NOW + MAX_AGE - MAX_AGE_PRIVILEGED_ORG_ACCESS - timedelta(seconds=1)).timestamp())
        )
        data["idl"] = str(int((NOW + timedelta(hours=1)).timestamp()))
        self.session[SESSION_KEY] = data
        self.save_session()
        with patch(f"{ENDPOINT_MODULE}.query_artifacts") as query:
            response = self.client.get(self.url, {"type": "workflow", "id": str(workflow.id)})
        assert response.status_code == 403, response.content
        query.assert_not_called()

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_event_data_secrecy_denies_before_eventstore_resolution(self):
        self.login_superuser()
        org = self.create_organization()
        org.flags.prevent_superuser_access = True
        org.save()
        project = self.create_project(organization=org)
        with self.feature("organizations:data-secrecy"):
            response = self.assert_denied_before_lookup(
                status_code=401,
                params={"type": "event", "id": EVENT_ID, "projectId": str(project.id)},
            )
        assert response.data["detail"]["code"] == "data-secrecy"

    def test_event_per_org_approval_denies_before_eventstore_resolution(self):
        self.login_superuser()
        project = self.create_project(organization=self.create_organization())
        with override_settings(
            SENTRY_SELF_HOSTED=False, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=True
        ):
            self.assert_denied_before_lookup(
                params={"type": "event", "id": EVENT_ID, "projectId": str(project.id)}
            )

    def test_backend_failure_has_safe_actionable_detail(self):
        self.login_superuser()
        workflow = self.create_workflow()
        with patch(
            f"{ENDPOINT_MODULE}.query_artifacts",
            side_effect=SnubaError("private tenant query details"),
        ):
            response = self.client.get(self.url, {"type": "workflow", "id": str(workflow.id)})
        assert response.status_code == 503, response.content
        assert response.data["detail"]
        assert "private tenant query details" not in str(response.data)
