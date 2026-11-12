from datetime import timedelta
from unittest.mock import patch
from uuid import UUID

from django.test import override_settings
from django.utils import timezone

from sentry.auth.superuser import COOKIE_NAME, MAX_AGE, MAX_AGE_PRIVILEGED_ORG_ACCESS, SESSION_KEY
from sentry.auth.system import SystemToken
from sentry.seer import agent_token
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.helpers.impersonation import simulate_impersonation
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode, cell_silo_test
from sentry.utils.security.orgauthtoken_token import generate_token, hash_token
from sentry.utils.snuba import SnubaError
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context
from sentry.workflow_engine.debug import ArtifactQueryResult
from sentry.workflow_engine.endpoints.admin_workflow_debugger import AdminWorkflowDebuggerEndpoint
from sentry.workflow_engine.processors.evaluations.eap import EAP_RETENTION_DAYS

ENDPOINT_MODULE = "sentry.workflow_engine.endpoints.admin_workflow_debugger"
NOW = before_now(minutes=1).replace(microsecond=0)
EVENT_ID = "1234567890abcdef1234567890abcdef"


@cell_silo_test
@override_settings(SENTRY_SELF_HOSTED=True)
@freeze_time(NOW)
class AdminWorkflowDebuggerTest(APITestCase):
    url = "/api/0/_admin/cells/test/workflow-engine/debugger/"

    def login_superuser(self):
        user = self.create_user(is_superuser=True, is_staff=False)
        self.login_as(user, superuser=True)
        return user

    def assert_denied_before_lookup(self, *, status_code=403, params=None, **headers):
        with (
            patch(
                f"{ENDPOINT_MODULE}.resolve_debugger_context",
                side_effect=AssertionError("Unauthorized item lookup"),
            ) as resolve,
            patch(
                f"{ENDPOINT_MODULE}.query_debugger_artifacts",
                side_effect=AssertionError("Unauthorized artifact query"),
            ) as query,
        ):
            response = self.client.get(
                self.url, params or {"type": "workflow", "id": "1"}, **headers
            )
        assert response.status_code == status_code, response.content
        resolve.assert_not_called()
        query.assert_not_called()
        return response

    def assert_anonymous_cannot_probe_items(self, params):
        self.assert_denied_before_lookup(params=params)

    def test_ordinary_user_denied(self):
        self.login_as(self.user)
        self.assert_denied_before_lookup()

    def assert_active_staff_is_not_superuser(self, rollout):
        staff = self.create_user(is_staff=True, is_superuser=False)
        self.login_as(staff, staff=True)
        with override_options({"staff.ga-rollout": rollout}):
            self.assert_denied_before_lookup()

    def test_superuser_flag_without_elevation_denied(self):
        self.login_as(self.create_user(is_superuser=True), superuser=False)
        self.assert_denied_before_lookup()

    def test_staff_elevation_does_not_elevate_superuser(self):
        self.login_as(self.create_user(is_superuser=True, is_staff=True), staff=True)
        self.assert_denied_before_lookup()

    def test_missing_superuser_cookie_denied(self):
        self.login_superuser()
        del self.client.cookies[COOKIE_NAME]
        self.assert_denied_before_lookup()

    def test_tampered_superuser_cookie_denied(self):
        self.login_superuser()
        self.client.cookies[COOKIE_NAME] = "invalid-signature"
        self.assert_denied_before_lookup()

    def assert_invalid_elevation_session_denied(self, field, value):
        self.login_superuser()
        data = dict(self.session[SESSION_KEY])
        data[field] = value
        self.session[SESSION_KEY] = data
        self.save_session()
        self.assert_denied_before_lookup()

    def test_missing_elevation_session_denied(self):
        self.login_superuser()
        del self.session[SESSION_KEY]
        self.save_session()
        self.assert_denied_before_lookup()

    def assert_expired_elevation_denied(self, field):
        self.login_superuser()
        data = dict(self.session[SESSION_KEY])
        data[field] = str(int((NOW - timedelta(seconds=1)).timestamp()))
        self.session[SESSION_KEY] = data
        self.save_session()
        self.assert_denied_before_lookup()

    def test_revoked_superuser_denied(self):
        user = self.login_superuser()
        with assume_test_silo_mode(SiloMode.CONTROL):
            user.update(is_superuser=False)
        self.assert_denied_before_lookup()

    def test_impersonating_an_ordinary_user_denied(self):
        superuser = self.login_superuser()
        self.login_as(self.user)
        with simulate_impersonation(superuser):
            self.assert_denied_before_lookup()

    def test_impersonation_rejected_even_if_target_is_elevated(self):
        self.login_superuser()
        with simulate_impersonation(self.create_user(is_superuser=True)):
            self.assert_denied_before_lookup()

    def test_superuser_personal_token_denied(self):
        user = self.create_user(is_superuser=True)
        token = self.create_user_auth_token(user, scope_list=["org:read", "event:read"])
        self.assert_denied_before_lookup(HTTP_AUTHORIZATION=f"Bearer {token.token}")

    def test_authorization_header_with_valid_elevated_cookie_denied(self):
        user = self.login_superuser()
        token = self.create_user_auth_token(user, scope_list=["org:read", "event:read"])
        self.assert_denied_before_lookup(HTTP_AUTHORIZATION=f"Bearer {token.token}")

    def test_organization_token_denied(self):
        token = generate_token(self.organization.slug, "http://testserver")
        self.create_org_auth_token(
            organization_id=self.organization.id,
            name="debugger token",
            token_hashed=hash_token(token),
            token_last_characters=token[-4:],
            scope_list=["org:ci"],
        )
        self.assert_denied_before_lookup(HTTP_AUTHORIZATION=f"Bearer {token}")

    def test_basic_credentials_with_valid_elevation_denied(self):
        self.login_superuser()
        self.assert_denied_before_lookup(HTTP_AUTHORIZATION="Basic dXNlcjpwYXNz")

    @override_settings(SEER_API_SHARED_SECRET="debugger-test-secret")
    def test_agent_credentials_denied(self):
        user = self.create_user(is_superuser=True)
        token, _ = agent_token.encode_agent_token(
            user_id=user.id,
            organization_id=self.organization.id,
            scopes=["org:read", "event:read"],
            session_id="debugger-test",
        )
        self.assert_denied_before_lookup(HTTP_AUTHORIZATION=f"Bearer {token}")

    @override_settings(SEER_API_SHARED_SECRET="debugger-test-secret")
    def test_signed_viewer_context_denied_even_with_elevation(self):
        user = self.login_superuser()
        context = encode_viewer_context(
            ViewerContext(actor=Actor(type=ActorType.USER, actor_id=user.id)),
            key="debugger-test-secret",
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
            patch(f"{ENDPOINT_MODULE}.resolve_debugger_context") as resolve,
            patch(f"{ENDPOINT_MODULE}.query_debugger_artifacts") as query,
        ):
            response = AdminWorkflowDebuggerEndpoint.as_view()(request, cell_id="test")
        assert response.status_code == 403
        resolve.assert_not_called()
        query.assert_not_called()

    def assert_invalid_input_rejected_before_lookup(self, params):
        self.login_superuser()
        # Empty params must remain empty rather than using the denial helper's default query.
        with (
            patch(f"{ENDPOINT_MODULE}.resolve_debugger_context") as resolve,
            patch(f"{ENDPOINT_MODULE}.query_debugger_artifacts") as query,
        ):
            response = self.client.get(self.url, params)
        assert response.status_code == 400, response.content
        assert response.data["detail"]
        resolve.assert_not_called()
        query.assert_not_called()

    def assert_mutation_method_unsupported(self, method):
        self.login_superuser()
        with (
            patch(f"{ENDPOINT_MODULE}.resolve_debugger_context") as resolve,
            patch(f"{ENDPOINT_MODULE}.query_debugger_artifacts") as query,
        ):
            response = getattr(self.client, method)(self.url, {"type": "workflow", "id": "1"})
        assert response.status_code == 405, response.content
        resolve.assert_not_called()
        query.assert_not_called()

    def assert_active_nonstaff_superuser_reads_another_organization(self, rollout):
        self.login_superuser()
        org = self.create_organization()
        project = self.create_project(organization=org)
        workflow = self.create_workflow(organization=org)
        with (
            override_options({"staff.ga-rollout": rollout}),
            patch(
                f"{ENDPOINT_MODULE}.query_debugger_artifacts",
                return_value=ArtifactQueryResult(artifacts=[], truncated=False),
            ) as query,
        ):
            response = self.client.get(self.url, {"type": "workflow", "id": f"00{workflow.id}"})
        assert response.status_code == 200, response.content
        assert response.data["item"]["id"] == str(workflow.id)
        assert response.data["item"]["organizationId"] == str(org.id)
        assert response.data["artifacts"] == []
        assert response.data["retentionDays"] == EAP_RETENTION_DAYS
        assert response.data["truncated"] is False
        assert response["Cache-Control"] == "no-store"
        assert query.call_args.kwargs["start"] == NOW - timedelta(days=1)
        assert query.call_args.kwargs["end"] == NOW
        assert query.call_args.args[0].project_ids == [project.id]

    def assert_project_scoped_item_needs_no_project_parameter(self, item_type):
        self.login_superuser()
        detector = self.create_detector(project=self.project)
        group = self.create_group(project=self.project)
        ids = {"detector": detector.id, "group": group.id}
        with patch(
            f"{ENDPOINT_MODULE}.query_debugger_artifacts",
            return_value=ArtifactQueryResult(artifacts=[], truncated=False),
        ) as query:
            response = self.client.get(self.url, {"type": item_type, "id": str(ids[item_type])})
        assert response.status_code == 200, response.content
        assert response.data["item"]["type"] == item_type
        assert response.data["item"]["projectId"] == str(self.project.id)
        assert query.call_args.args[0].project_ids == [self.project.id]

    def test_event_id_and_project_are_normalized(self):
        self.login_superuser()
        event = self.store_event(
            data={"event_id": EVENT_ID, "message": "debugger event", "timestamp": NOW.timestamp()},
            project_id=self.project.id,
        )
        with (
            patch(
                "sentry.workflow_engine.debug.eventstore.backend.get_event_by_id",
                return_value=event,
            ) as get_event,
            patch(
                f"{ENDPOINT_MODULE}.query_debugger_artifacts",
                return_value=ArtifactQueryResult(artifacts=[], truncated=False),
            ) as query,
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
        assert response.data["item"]["projectId"] == str(self.project.id)
        assert query.call_args.args[0].project_ids == [self.project.id]
        assert get_event.call_args.args[:2] == (self.project.id, EVENT_ID)
        assert get_event.call_args.kwargs["tenant_ids"] == {"organization_id": self.organization.id}

    def test_missing_event_project_is_not_found_before_eventstore_resolution(self):
        self.login_superuser()
        with patch("sentry.workflow_engine.debug.eventstore.backend.get_event_by_id") as get_event:
            response = self.assert_denied_before_lookup(
                status_code=404,
                params={"type": "event", "id": EVENT_ID, "projectId": str(2**63 - 1)},
            )
        assert "item" not in response.data
        get_event.assert_not_called()

    def test_retention_metadata_does_not_change_seven_day_window(self):
        self.login_superuser()
        workflow = self.create_workflow()
        with (
            patch(f"{ENDPOINT_MODULE}.EAP_RETENTION_DAYS", 30),
            patch(
                f"{ENDPOINT_MODULE}.query_debugger_artifacts",
                return_value=ArtifactQueryResult(artifacts=[], truncated=False),
            ) as query,
        ):
            response = self.client.get(
                self.url, {"type": "workflow", "id": str(workflow.id), "statsPeriod": "7d"}
            )
        assert response.status_code == 200, response.content
        assert response.data["retentionDays"] == 30
        assert query.call_args.kwargs["start"] == NOW - timedelta(days=7)
        assert query.call_args.kwargs["end"] == NOW

    def test_missing_item_is_not_empty_history(self):
        self.login_superuser()
        with patch(f"{ENDPOINT_MODULE}.query_debugger_artifacts") as query:
            response = self.client.get(self.url, {"type": "workflow", "id": str(2**63 - 1)})
        assert response.status_code == 404, response.content
        query.assert_not_called()

    def assert_time_window_is_bounded_and_reported(self, period, duration):
        self.login_superuser()
        workflow = self.create_workflow()
        with patch(
            f"{ENDPOINT_MODULE}.query_debugger_artifacts",
            return_value=ArtifactQueryResult(artifacts=[], truncated=True),
        ) as query:
            response = self.client.get(
                self.url, {"type": "workflow", "id": str(workflow.id), "statsPeriod": period}
            )
        assert response.status_code == 200, response.content
        assert query.call_args.kwargs["end"] == timezone.now()
        assert query.call_args.kwargs["start"] == timezone.now() - duration
        assert response.data["start"] == (NOW - duration).isoformat()
        assert response.data["end"] == NOW.isoformat()
        assert response.data["truncated"] is True

    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_data_secrecy_denies_before_artifact_query(self):
        self.login_superuser()
        org = self.create_organization()
        org.flags.prevent_superuser_access = True
        org.save()
        workflow = self.create_workflow(organization=org)
        with (
            self.feature("organizations:data-secrecy"),
            patch(f"{ENDPOINT_MODULE}.query_debugger_artifacts") as query,
        ):
            response = self.client.get(self.url, {"type": "workflow", "id": str(workflow.id)})
        assert response.status_code == 401, response.content
        assert response.data["detail"]["code"] == "data-secrecy"
        assert "item" not in response.data
        query.assert_not_called()

    def test_per_organization_authorization_required(self):
        self.login_superuser()
        workflow = self.create_workflow(organization=self.create_organization())
        with (
            override_settings(
                SENTRY_SELF_HOSTED=False, VALIDATE_SUPERUSER_ACCESS_CATEGORY_AND_REASON=True
            ),
            patch(f"{ENDPOINT_MODULE}.query_debugger_artifacts") as query,
        ):
            response = self.client.get(self.url, {"type": "workflow", "id": str(workflow.id)})
        assert response.status_code == 403, response.content
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
            patch(
                f"{ENDPOINT_MODULE}.query_debugger_artifacts",
                return_value=ArtifactQueryResult(artifacts=[], truncated=False),
            ) as query,
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
        with patch(f"{ENDPOINT_MODULE}.query_debugger_artifacts") as query:
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
            f"{ENDPOINT_MODULE}.query_debugger_artifacts",
            side_effect=SnubaError("private tenant query details"),
        ):
            response = self.client.get(self.url, {"type": "workflow", "id": str(workflow.id)})
        assert response.status_code == 503, response.content
        assert response.data["detail"]
        assert "private tenant query details" not in str(response.data)

    def test_anonymous_cannot_probe_existing_item(self):
        self.assert_anonymous_cannot_probe_items({"type": "workflow", "id": "1"})

    def test_anonymous_cannot_probe_invalid_item(self):
        self.assert_anonymous_cannot_probe_items({"id": "invalid"})

    def test_active_staff_denied_before_staff_rollout(self):
        self.assert_active_staff_is_not_superuser(False)

    def test_active_staff_denied_after_staff_rollout(self):
        self.assert_active_staff_is_not_superuser(True)

    def test_mismatched_elevation_token_denied(self):
        self.assert_invalid_elevation_session_denied("tok", "different-token")

    def test_mismatched_elevation_user_denied(self):
        self.assert_invalid_elevation_session_denied("uid", "0")

    def test_empty_elevation_token_denied(self):
        self.assert_invalid_elevation_session_denied("tok", "")

    def test_absolute_elevation_expiry_denied(self):
        self.assert_expired_elevation_denied("exp")

    def test_idle_elevation_expiry_denied(self):
        self.assert_expired_elevation_denied("idl")

    def test_missing_input_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup({})

    def test_unknown_type_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup({"type": "unknown", "id": "1"})

    def test_empty_id_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup({"type": "workflow", "id": ""})

    def test_zero_id_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup({"type": "workflow", "id": "0"})

    def test_negative_id_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup({"type": "workflow", "id": "-1"})

    def test_fractional_id_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup({"type": "workflow", "id": "1.0"})

    def test_injection_id_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup({"type": "workflow", "id": "1 OR 1=1"})

    def test_overflow_id_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup({"type": "detector", "id": str(2**63)})

    def test_oversized_id_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup({"type": "group", "id": "9" * 1000})

    def test_malformed_event_id_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup(
            {"type": "event", "id": "not-a-uuid", "projectId": "1"}
        )

    def test_event_without_project_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup({"type": "event", "id": EVENT_ID})

    def test_event_zero_project_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup(
            {"type": "event", "id": EVENT_ID, "projectId": "0"}
        )

    def test_event_negative_project_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup(
            {"type": "event", "id": EVENT_ID, "projectId": "-1"}
        )

    def test_event_overflow_project_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup(
            {"type": "event", "id": EVENT_ID, "projectId": str(2**63)}
        )

    def test_excessive_time_window_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup(
            {"type": "workflow", "id": "1", "statsPeriod": "8d"}
        )

    def test_zero_time_window_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup(
            {"type": "workflow", "id": "1", "statsPeriod": "0h"}
        )

    def test_negative_time_window_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup(
            {"type": "workflow", "id": "1", "statsPeriod": "-1h"}
        )

    def test_workflow_project_scope_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup(
            {"type": "workflow", "id": "1", "projectId": "1"}
        )

    def test_organization_scope_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup(
            {"type": "workflow", "id": "1", "organizationId": "1"}
        )

    def test_query_text_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup(
            {"type": "workflow", "id": "1", "query": "workflow_id:1"}
        )

    def test_custom_limit_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup(
            {"type": "workflow", "id": "1", "limit": "10000"}
        )

    def test_custom_start_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup(
            {"type": "workflow", "id": "1", "start": "1900-01-01"}
        )

    def test_duplicate_id_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup({"type": "workflow", "id": ["1", "2"]})

    def test_empty_time_window_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup(
            {"type": "workflow", "id": "1", "statsPeriod": ""}
        )

    def test_event_fractional_project_rejected_before_lookup(self):
        self.assert_invalid_input_rejected_before_lookup(
            {"type": "event", "id": EVENT_ID, "projectId": "1.0"}
        )

    def test_post_unsupported(self):
        self.assert_mutation_method_unsupported("post")

    def test_put_unsupported(self):
        self.assert_mutation_method_unsupported("put")

    def test_patch_unsupported(self):
        self.assert_mutation_method_unsupported("patch")

    def test_delete_unsupported(self):
        self.assert_mutation_method_unsupported("delete")

    def test_active_nonstaff_superuser_cross_org_before_staff_rollout(self):
        self.assert_active_nonstaff_superuser_reads_another_organization(False)

    def test_active_nonstaff_superuser_cross_org_after_staff_rollout(self):
        self.assert_active_nonstaff_superuser_reads_another_organization(True)

    def test_detector_needs_no_project_parameter(self):
        self.assert_project_scoped_item_needs_no_project_parameter("detector")

    def test_group_needs_no_project_parameter(self):
        self.assert_project_scoped_item_needs_no_project_parameter("group")

    def test_one_hour_time_window(self):
        self.assert_time_window_is_bounded_and_reported("1h", timedelta(hours=1))

    def test_one_day_time_window(self):
        self.assert_time_window_is_bounded_and_reported("24h", timedelta(days=1))

    def test_seven_day_time_window(self):
        self.assert_time_window_is_bounded_and_reported("7d", timedelta(days=7))
