from __future__ import annotations

import re
from collections.abc import Callable
from contextlib import ExitStack, nullcontext
from datetime import timedelta
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch
from urllib.parse import urlencode
from uuid import uuid4

import pytest
import requests
from django.conf import settings
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import transaction
from django.http import HttpResponse
from django.test import override_settings
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.test import APIClient

from sentry.api.endpoints.seer_models import SEER_MODELS_CACHE_KEY
from sentry.attachments.base import CachedAttachment
from sentry.auth import access
from sentry.flags.models import PROVIDER_MAP, ActionEnum, CreatedByTypeEnum, FlagAuditLogModel
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.subscription_limits import METRIC_SUBSCRIPTION_FEATURE_FLAGS
from sentry.models.custominboundfilter import CustomInboundFilter
from sentry.models.eventattachment import EventAttachment
from sentry.models.organizationmember import OrganizationMember
from sentry.replays.lib.storage import FilestoreBlob, RecordingSegmentStorageMeta
from sentry.replays.testutils import mock_replay, mock_replay_viewed
from sentry.seer import agent_token
from sentry.silo.base import SiloMode
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import SnubaQuery, SnubaQueryEventType
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.testutils.skips import requires_snuba
from sentry.utils import json
from sentry.viewer_context import (
    Actor,
    ActorType,
    ViewerContext,
    encode_viewer_context,
)
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import DetectorPriorityLevel
from tests.sentry.seer.endpoints.test_organization_agent_token import (
    AGENT_SUDO_BOUNDARY_MUTATIONS,
    FLAG,
    OUTER_BOUNDARY_GET_STATUSES,
    OUTER_BOUNDARY_MUTATION_STATUSES,
    SECRET,
    SERVICE_ACCOUNT_KNOWN_GAPS,
    SERVICE_ACCOUNT_SCOPES,
    USER_GLOBAL_GET_ENDPOINTS,
    MatrixAuthentication,
    PublicGetEndpoint,
    PublicMutationEndpoint,
    _matrix_cases,
    _mutation_matrix_cases,
    _private_helper_get_matrix_cases,
)


@pytest.mark.sentry_metrics
@pytest.mark.seer_agent_token_matrix
@requires_snuba
@override_settings(SEER_API_SHARED_SECRET=SECRET, SENTRY_SELF_HOSTED=False)
class AgentTokenPublicGetMatrixTest(APITestCase):
    """Differential, full-stack authentication coverage for the public API.

    Every row uses a real database user, organization membership, team, and project.
    Session responses validate the fixture and are the oracle for full-authority user
    tokens and ViewerContext. An agent response is compared with a real user token minted
    for the same user with exactly the same scopes. This deliberately treats each
    endpoint's current scope behavior as the contract, without asserting that its scope
    map is correct. The exception is proof-of-user-presence gates, which agent tokens
    intentionally cannot satisfy. Any other difference therefore isolates agent-token
    compatibility or a scope escape rather than a pre-existing endpoint scope problem.
    A zero-scope token exercises explicit mint-time narrowing against every operation.

    Endpoint-specific tests remain responsible for response payload semantics; this
    matrix is the source of truth for authentication and permission outcomes.

    Run the complete matrix with ``-m seer_agent_token_matrix``. Use normal pytest
    name filtering for focused iteration (for example, ``-k private_helper``).
    """

    def setUp(self) -> None:
        super().setUp()
        rate_limit_patcher = patch(
            "sentry.middleware.ratelimit.get_rate_limit_value", return_value=None
        )
        rate_limit_patcher.start()
        self.addCleanup(rate_limit_patcher.stop)
        self.owner = self.create_user()
        self.org = self.create_organization(owner=self.owner)
        self.team = self.create_team(organization=self.org)
        self.project = self.create_project(organization=self.org, teams=[self.team])
        self.member = OrganizationMember.objects.get(organization=self.org, user_id=self.owner.id)
        self.create_team_membership(team=self.team, member=self.member)

        # Fixture helpers conventionally read these attributes.
        self.user = self.owner
        self.organization = self.org
        self._matrix_resources: dict[str, Any] = {}
        self.login_as(self.owner)

    def _resource(self, name: str) -> Any:
        if name in self._matrix_resources:
            return self._matrix_resources[name]

        if name == "dashboard":
            resource = self.create_dashboard(organization=self.org, created_by=self.owner)
        elif name == "custom_inbound_filter":
            resource = CustomInboundFilter.objects.create(
                project=self.project,
                name="Permission matrix filter",
                data_type="all",
                conditions=[{"type": "release", "value": ["1.*"]}],
            )
        elif name == "detector":
            resource = self.create_detector(project=self.project)
        elif name == "mutable_detector":
            resource = self.create_detector(project=self.project, type="metric_issue")
        elif name == "environment":
            resource = self.create_environment(project=self.project, name="production")
        elif name == "event":
            resource = self.store_event(
                data={
                    "event_id": uuid4().hex,
                    "environment": self._resource("environment").name,
                    "exception": {"values": []},
                    "message": "permission matrix event",
                    "platform": "javascript",
                    "timestamp": timezone.now().isoformat(),
                },
                project_id=self.project.id,
            )
        elif name == "event_attachment":
            event = self._resource("event")
            cached_attachment = CachedAttachment(
                name="permission-matrix.txt",
                content_type="text/plain",
                data=b"permission matrix attachment",
            )
            attachment_file = EventAttachment.putfile(self.project.id, cached_attachment)
            resource = EventAttachment.objects.create(
                event_id=event.event_id,
                project_id=self.project.id,
                group_id=event.group_id,
                type=cached_attachment.type,
                name=cached_attachment.name,
                content_type=attachment_file.content_type,
                size=attachment_file.size,
                sha1=attachment_file.sha1,
                blob_path=attachment_file.blob_path,
            )
        elif name == "group":
            resource = self._resource("event").group
        elif name == "integration":
            resource = self.create_integration(
                organization=self.org,
                external_id=f"matrix-{uuid4()}",
                provider="example",
                name="Matrix integration",
            )
        elif name == "channel_integration":
            resource = self.create_integration(
                organization=self.org,
                external_id=f"matrix-slack-{uuid4()}",
                provider="slack",
                name="Matrix Slack integration",
            )
        elif name == "codeowners_integration":
            resource = self.create_integration(
                organization=self.org,
                external_id=f"matrix-github-{uuid4()}",
                provider="github",
                name="Matrix GitHub integration",
            )
        elif name == "code_mapping":
            _integration, organization_integration = self.create_provider_integration_for(
                self.org,
                self.owner,
                provider="example",
                external_id=f"matrix-codeowners-{uuid4()}",
                name="Matrix CODEOWNERS integration",
            )
            resource = self.create_code_mapping(
                project=self.project,
                organization_integration=organization_integration,
            )
        elif name == "scm_code_mapping":
            _integration, organization_integration = self.create_provider_integration_for(
                self.org,
                self.owner,
                provider="github",
                external_id=f"matrix-github-{uuid4()}",
                name="Matrix GitHub integration",
            )
            repo = self.create_repo(
                project=self.project,
                name="permission-matrix/repo",
                provider="integrations:github",
                integration_id=_integration.id,
            )
            resource = self.create_code_mapping(
                project=self.project,
                repo=repo,
                organization_integration=organization_integration,
            )
        elif name == "codeowners":
            resource = self.create_codeowners(
                project=self.project,
                code_mapping=self._resource("code_mapping"),
                raw="",
                schema={},
            )
        elif name == "scm_repository":
            integration, _organization_integration = self.create_provider_integration_for(
                self.org,
                self.owner,
                provider="github",
                external_id=f"matrix-github-{uuid4()}",
                name="Matrix GitHub integration",
            )
            resource = self.create_repo(
                project=self.project,
                name="permission-matrix/bulk-repo",
                provider="integrations:github",
                integration_id=integration.id,
                external_id="123",
                url="https://github.com/permission-matrix/bulk-repo",
            )
        elif name == "data_forwarder":
            resource = self.create_data_forwarder(
                organization=self.org,
                provider="segment",
                config={"write_key": "matrix-key"},
            )
        elif name == "flag_log":
            resource = FlagAuditLogModel.objects.create(
                action=ActionEnum.UPDATED.value,
                created_by="permission-matrix@example.com",
                created_by_type=CreatedByTypeEnum.EMAIL.value,
                flag="permission-matrix-flag",
                organization_id=self.org.id,
                provider=PROVIDER_MAP["generic"],
                tags={"environment": "production"},
            )
        elif name == "detector_condition_group":
            resource = self.create_data_condition_group(organization_id=self.org.id)
        elif name == "external_team":
            resource = self.create_external_team(
                team=self.team,
                integration=self._resource("codeowners_integration"),
            )
        elif name == "external_user":
            resource = self.create_external_user(
                user=self.owner,
                organization=self.org,
                integration=self._resource("codeowners_integration"),
                external_name="@permission-matrix",
            )
        elif name == "external_issue":
            with self.feature("organizations:integrations-issue-basic"):
                response = self.client.put(
                    f"/api/0/organizations/{self.org.slug}/issues/"
                    f"{self._resource('group').id}/integrations/"
                    f"{self._resource('integration').id}/",
                    data={"externalIssue": "MATRIX-123"},
                    format="json",
                )
            assert response.status_code == 201, response.content
            resource = response.data
        elif name == "monitor":
            resource = self.create_monitor(project=self.project, organization=self.org)
        elif name == "notification_action":
            resource = self.create_notification_action(
                organization=self.org, projects=[self.project]
            )
        elif name == "preprod_artifact":
            resource = self.create_preprod_artifact(project=self.project)
        elif name == "preprod_snapshot":
            response = self.client.post(
                f"/api/0/projects/{self.org.slug}/{self.project.slug}/preprodartifacts/snapshots/",
                data={
                    "app_id": "com.example.permission-matrix-resource",
                    "images": {
                        "permission-matrix.png": {
                            "content_hash": "permission-matrix-image",
                            "display_name": "Permission Matrix",
                            "width": 100,
                            "height": 100,
                        }
                    },
                },
                format="json",
            )
            assert response.status_code == 200, response.content
            resource = response.data
        elif name == "project_key":
            resource = self.create_project_key(project=self.project)
        elif name == "release":
            resource = self.create_release(project=self.project, user=self.owner)
        elif name == "release_file":
            resource = self.create_release_file(
                release_id=self._resource("release").id,
                file=self.create_file(name="matrix.js", type="release.file"),
            )
        elif name == "replay":
            replay_id = uuid4().hex
            self._store_replay(
                mock_replay(
                    timezone.now() - timedelta(seconds=10),
                    self.project.id,
                    replay_id,
                )
            )
            self._store_replay(
                mock_replay_viewed(
                    timezone.now().timestamp(),
                    self.project.id,
                    replay_id,
                    self.owner.id,
                )
            )
            resource = replay_id
        elif name == "replay_deletion_job":
            now = timezone.now()
            resource = self.create_replay_deletion_job(
                project=self.project,
                range_start=now - timedelta(days=2),
                range_end=now - timedelta(days=1),
                query="",
                environments=["production"],
                status="in-progress",
            )
        elif name == "replay_recording_segment":
            metadata = RecordingSegmentStorageMeta(
                project_id=self.project.id,
                replay_id=self._resource("replay"),
                segment_id=0,
                retention_days=None,
            )
            FilestoreBlob().set(metadata, b'[{"type": 5, "data": {}}]')
            resource = metadata
        elif name == "repository":
            resource = self.create_repo(project=self.project)
        elif name == "secondary_member":
            secondary_user = self.create_user()
            resource = self.create_member(
                organization=self.org,
                user=secondary_user,
                role="member",
            )
            self.create_team_membership(team=self.team, member=resource)
        elif name == "saved_query":
            with self.feature("organizations:discover-query"):
                response = self.client.post(
                    f"/api/0/organizations/{self.org.slug}/discover/saved/",
                    data={
                        "name": "Permission matrix query",
                        "projects": [self.project.id],
                        "queryDataset": "error-events",
                        "fields": ["title"],
                        "query": "is:unresolved",
                        "version": 2,
                    },
                    format="json",
                )
            assert response.status_code == 201, response.content
            resource = response.data
        elif name == "sentry_app":
            resource = self.create_sentry_app(
                name=f"matrix-{uuid4()}", organization=self.org, published=True
            )
        elif name == "sentry_app_installation":
            resource = self.create_sentry_app_installation(
                organization=self.org,
                slug=self._resource("sentry_app").slug,
                user=self.owner,
            )
        elif name == "platform_external_issue":
            resource = self.create_platform_external_issue(
                group=self._resource("group"),
                service_type="sentry-app",
                display_name="Matrix#1",
                web_url="https://example.com/issues/1",
            )
        elif name == "mutable_sentry_app":
            resource = self.create_sentry_app(
                name=f"matrix-mutable-{uuid4()}",
                organization=self.org,
                published=False,
            )
        elif name == "service_hook":
            resource = self.create_service_hook(
                actor=self.owner, org=self.org, project=self.project
            )
        elif name == "symbol_source":
            resource = {
                "id": "permission-matrix-source",
                "name": "Permission matrix source",
                "layout": {"type": "native"},
                "type": "http",
                "url": "https://symbols.example.com",
                "username": "matrix",
                "password": "matrix-password",
            }
            self.project.update_option("sentry:symbol_sources", json.dumps([resource]))
        elif name == "workflow":
            resource = self.create_workflow(organization=self.org)
        else:
            raise AssertionError(f"unknown matrix resource {name!r}")

        self._matrix_resources[name] = resource
        return resource

    def _store_replay(self, replay: dict[str, Any]) -> None:
        response = requests.post(
            settings.SENTRY_SNUBA + "/tests/entities/replays/insert",
            json=[replay],
            timeout=30,
        )
        assert response.status_code == 200, response.content

    def _path_value(
        self,
        placeholder: str,
        endpoint: PublicGetEndpoint | PublicMutationEndpoint,
    ) -> str:
        path_template = endpoint.path_template
        if placeholder == "var":
            return "issues"
        if placeholder == "organization_id_or_slug":
            return self.org.slug
        if placeholder == "project_id_or_slug":
            return self.project.slug
        if placeholder == "codeowners_id":
            return str(self._resource("codeowners").id)
        if placeholder == "config_id":
            return str(self._resource("scm_code_mapping").id)
        if placeholder == "team_id_or_slug":
            if endpoint.endpoint_name == "OrganizationSCIMTeamDetails":
                return str(self.team.id)
            return self.team.slug
        if placeholder == "member_id":
            member = (
                self._resource("secondary_member")
                if isinstance(endpoint, PublicMutationEndpoint)
                else self.member
            )
            return str(member.id)
        if placeholder == "attachment_id":
            return str(self._resource("event_attachment").id)
        if placeholder == "dashboard_id":
            return str(self._resource("dashboard").id)
        if placeholder == "detector_id":
            detector = (
                self._resource("mutable_detector")
                if isinstance(endpoint, PublicMutationEndpoint)
                else self._resource("detector")
            )
            return str(detector.id)
        if placeholder == "environment":
            return self._resource("environment").name
        if placeholder == "issue_id":
            return str(self._resource("group").id)
        if placeholder == "integration_id":
            if endpoint.endpoint_name == "OrganizationIntegrationChannelValidateEndpoint":
                return str(self._resource("channel_integration").id)
            return str(self._resource("integration").id)
        if placeholder == "data_forwarder_id":
            return str(self._resource("data_forwarder").id)
        if placeholder == "flag_log_id":
            return str(self._resource("flag_log").id)
        if placeholder == "external_team_id":
            return str(self._resource("external_team").id)
        if placeholder == "external_user_id":
            return str(self._resource("external_user").id)
        if placeholder == "monitor_id_or_slug":
            return str(self._resource("monitor").guid)
        if placeholder == "action_id":
            return str(self._resource("notification_action").id)
        if placeholder == "artifact_id":
            return str(self._resource("preprod_artifact").id)
        if placeholder == "key_id":
            return self._resource("project_key").public_key
        if placeholder == "version":
            return self._resource("release").version
        if placeholder == "file_id":
            return str(self._resource("release_file").id)
        if placeholder == "repo_id":
            return str(self._resource("repository").id)
        if placeholder == "sentry_app_id_or_slug":
            sentry_app = (
                self._resource("mutable_sentry_app")
                if isinstance(endpoint, PublicMutationEndpoint)
                else self._resource("sentry_app")
            )
            return str(sentry_app.id)
        if placeholder == "uuid" and endpoint.endpoint_name in {
            "SentryAppInstallationExternalRequestsEndpoint",
            "SentryAppInstallationExternalIssueActionsEndpoint",
        }:
            return str(self._resource("sentry_app_installation").uuid)
        if (
            placeholder == "external_issue_id"
            and endpoint.endpoint_name == "GroupExternalIssueDetailsEndpoint"
        ):
            return str(self._resource("platform_external_issue").id)
        if placeholder == "hook_id":
            return str(self._resource("service_hook").id)
        if placeholder == "workflow_id":
            return str(self._resource("workflow").id)
        if placeholder == "key":
            return "environment"
        if placeholder == "filter_id":
            if endpoint.endpoint_name == "CustomInboundFilterDetailsEndpoint":
                return str(self._resource("custom_inbound_filter").id)
            return "browser-extensions"
        if placeholder == "event_id":
            return self._resource("event").event_id
        if placeholder == "job_id":
            return str(self._resource("replay_deletion_job").id)
        if placeholder == "query_id":
            return str(self._resource("saved_query")["id"])
        if placeholder == "replay_id":
            return self._resource("replay")
        if placeholder == "segment_id":
            self._resource("replay_recording_segment")
            return "0"
        if placeholder == "snapshot_id" and endpoint.endpoint_name in {
            "OrganizationPreprodSnapshotEndpoint",
            "OrganizationPreprodSnapshotImageDetailEndpoint",
        }:
            return str(self._resource("preprod_snapshot")["artifactId"])
        if placeholder == "image_identifier":
            self._resource("preprod_snapshot")
            return "permission-matrix.png"
        if placeholder == "resource_type_name":
            return "User"
        if placeholder == "schema_uri":
            return "urn:ietf:params:scim:schemas:core:2.0:User"

        # These resources live in external storage or require a specialized service.
        # A well-formed nonexistent identifier still exercises authentication, endpoint
        # scopes, URL conversion, and the outer resource permission boundary.
        opaque_values = {
            "conversation_id": uuid4().hex,
            "external_issue_id": "1",
            "profile_id": uuid4().hex,
            "snapshot_id": "1",
            "trace_id": uuid4().hex,
        }
        if placeholder in opaque_values:
            return opaque_values[placeholder]
        raise AssertionError(
            f"{path_template} introduced unsupported path placeholder {placeholder!r}"
        )

    def _path(self, endpoint: PublicGetEndpoint | PublicMutationEndpoint) -> str:
        path = endpoint.path_template
        for placeholder in re.findall(r"{([^}]+)}", path):
            path = path.replace("{" + placeholder + "}", self._path_value(placeholder, endpoint))
        query_params = self._query_params(endpoint)
        if query_params:
            path = f"{path}?{urlencode(query_params, doseq=True)}"
        return path

    def _query_params(self, endpoint: PublicGetEndpoint | PublicMutationEndpoint) -> dict[str, Any]:
        if endpoint.endpoint_name == "ProjectStacktraceLinkEndpoint":
            return {"file": "src/matrix.py", "platform": "python"}
        if endpoint.endpoint_name == "OrganizationIntegrationChannelValidateEndpoint":
            return {"channel": "permission-matrix"}
        if endpoint.endpoint_name == "OrganizationEventsEndpoint":
            return {
                "field": ["id", "project"],
                "project": [self.project.id],
                "statsPeriod": "1h",
            }
        if endpoint.endpoint_name == "OrganizationEventsDroppedEndpoint":
            return {
                "dataset": "spans",
                "project": [self.project.id],
                "statsPeriod": "1h",
                "interval": "1h",
            }
        if endpoint.endpoint_name == "OrganizationPreprodLatestBaseSnapshotEndpoint":
            self._resource("preprod_snapshot")
            return {"app_id": "com.example.permission-matrix-resource"}
        if endpoint.endpoint_name == "OrganizationProfilingChunksEndpoint":
            return {
                "profiler_id": uuid4().hex,
                "project": [self.project.id],
                "statsPeriod": "1h",
            }
        if endpoint.endpoint_name == "OrganizationProfilingFlamegraphEndpoint":
            return {"project": [self.project.id], "statsPeriod": "1h"}
        if endpoint.endpoint_name == "ReleaseThresholdStatusIndexEndpoint":
            now = timezone.now()
            return {
                "start": (now - timedelta(hours=1)).isoformat(),
                "end": now.isoformat(),
            }
        if endpoint.endpoint_name == "OrganizationSessionsEndpoint":
            return {
                "field": ["sum(session)"],
                "project": [self.project.id],
                "statsPeriod": "1h",
            }
        if endpoint.endpoint_name in {
            "OrganizationStatsSummaryEndpoint",
            "OrganizationStatsEndpointV2",
        }:
            params: dict[str, Any] = {
                "field": ["sum(quantity)"],
                "project": [self.project.id],
                "statsPeriod": "1h",
                "interval": "1h",
            }
            if endpoint.endpoint_name == "OrganizationStatsEndpointV2":
                params["category"] = "error"
            return params
        if (
            endpoint.endpoint_name == "OrganizationStarredServiceSpansEndpoint"
            and isinstance(endpoint, PublicMutationEndpoint)
            and endpoint.method == "DELETE"
        ):
            return {"service_span": "permission-matrix-span", "project_id": self.project.id}
        if endpoint.endpoint_name == "OrganizationTraceItemAttributesEndpoint":
            return {"dataset": "spans", "project": [self.project.id]}
        if endpoint.endpoint_name == "OrganizationTraceItemStatsEndpoint":
            return {
                "statsType": ["attributeDistributions"],
                "itemType": "spans",
                "project": [self.project.id],
            }
        if endpoint.endpoint_name == "OrganizationDetectorIndexEndpoint" and isinstance(
            endpoint, PublicMutationEndpoint
        ):
            return {"id": [self._resource("mutable_detector").id]}
        if endpoint.endpoint_name == "OrganizationWorkflowIndexEndpoint" and isinstance(
            endpoint, PublicMutationEndpoint
        ):
            return {"id": [self._resource("workflow").id]}
        if (
            endpoint.endpoint_name == "GroupIntegrationDetailsEndpoint"
            and isinstance(endpoint, PublicMutationEndpoint)
            and endpoint.method == "DELETE"
        ):
            return {"externalIssue": self._resource("external_issue")["id"]}
        if endpoint.endpoint_name == "GroupIntegrationDetailsEndpoint":
            return {"action": "link"}
        if endpoint.endpoint_name == "SentryAppInstallationExternalRequestsEndpoint":
            return {"uri": "/options", "projectId": self.project.id}
        if (
            endpoint.endpoint_name == "ProjectSymbolSourcesEndpoint"
            and isinstance(endpoint, PublicMutationEndpoint)
            and endpoint.method in {"DELETE", "PUT"}
        ):
            return {"id": self._resource("symbol_source")["id"]}
        if endpoint.endpoint_name == "ProjectPreprodBuildDistributionLatestEndpoint":
            return {"appId": "com.example.matrix", "platform": "apple"}
        return {}

    def _feature_flags(
        self, endpoint: PublicGetEndpoint | PublicMutationEndpoint
    ) -> dict[str, bool]:
        flags = {FLAG: True}
        endpoint_flags = {
            "CustomInboundFilterDetailsEndpoint": "organizations:inbound-filters-v2",
            "CustomInboundFiltersEndpoint": "organizations:inbound-filters-v2",
            "DataForwardingDetailsEndpoint": "organizations:data-forwarding",
            "DataForwardingIndexEndpoint": "organizations:data-forwarding",
            "DiscoverSavedQueryDetailEndpoint": "organizations:discover-query",
            "DiscoverSavedQueriesEndpoint": "organizations:discover-query",
            "ExternalTeamDetailsEndpoint": "organizations:integrations-codeowners",
            "ExternalTeamEndpoint": "organizations:integrations-codeowners",
            "ExternalUserDetailsEndpoint": "organizations:integrations-codeowners",
            "ExternalUserEndpoint": "organizations:integrations-codeowners",
            "EventAttachmentDetailsEndpoint": "organizations:event-attachments",
            "GroupIntegrationDetailsEndpoint": "organizations:integrations-issue-basic",
            "OrganizationEventsEndpoint": "organizations:discover-basic",
            "OrganizationGroupSearchViewsEndpoint": "organizations:issue-views",
            "OrganizationProfilingChunksEndpoint": "organizations:continuous-profiling",
            "OrganizationProfilingFlamegraphEndpoint": "organizations:profiling",
            "OrganizationStarredServiceSpansEndpoint": "organizations:insights-modules-use-eap",
            "OrganizationTraceItemAttributesEndpoint": "organizations:visibility-explore-view",
            "OrganizationTraceItemMetricsEndpoint": "organizations:visibility-explore-view",
            "ProjectProfilingProfileEndpoint": "organizations:profiling",
            "ProjectCodeOwnersDetailsEndpoint": "organizations:integrations-codeowners",
            "ProjectCodeOwnersEndpoint": "organizations:integrations-codeowners",
        }
        if feature := endpoint_flags.get(endpoint.endpoint_name):
            flags[feature] = True
        if endpoint.endpoint_name == "OrganizationProjectDetectorIndexEndpoint":
            flags.update(METRIC_SUBSCRIPTION_FEATURE_FLAGS)
        if endpoint.endpoint_name.startswith("CustomInboundFilter"):
            flags["projects:custom-inbound-filters"] = True
        if "Replay" in endpoint.endpoint_name:
            flags["organizations:session-replay"] = True
        return flags

    def _mint_agent_token(
        self,
        *,
        approved_scopes: frozenset[str] = frozenset(),
        requested_scopes: frozenset[str] | None = None,
    ) -> str:
        if approved_scopes:
            approval = self.client.post(
                f"/api/0/organizations/{self.org.slug}/agent/approve/",
                data={
                    "sessionId": "permission-matrix",
                    "scopes": sorted(approved_scopes),
                },
                format="json",
            )
            assert approval.status_code == 200, approval.content
            assert approved_scopes <= set(approval.data["scopes"]), approval.data
        payload: dict[str, Any] = {"sessionId": "permission-matrix"}
        if requested_scopes is not None:
            payload["requestedScopes"] = sorted(requested_scopes)
        response = self.client.post(
            f"/api/0/organizations/{self.org.slug}/agent/token/",
            data=payload,
            format="json",
        )
        assert response.status_code == 200, response.content
        assert approved_scopes <= set(response.data["scopes"]), response.data
        if requested_scopes is not None:
            assert set(response.data["scopes"]) <= requested_scopes, response.data
        return response.data["token"]

    @staticmethod
    def _listed_ids(response: Response, *, nested_organization: bool = False) -> set[int]:
        assert response.status_code == 200, response.content
        if nested_organization:
            return {int(item["organization"]["id"]) for item in response.data}
        return {int(item["id"]) for item in response.data}

    def test_agent_organization_index_is_bound_to_minted_organization(self) -> None:
        """An identity-compatible agent must not turn an org-bound token into a user list.

        ``owner=1`` deliberately exercises the account-close branch, which otherwise
        reads all ownerships from the compatibility user before applying token bounds.
        Both cell and control implementations must retain the minted organization cap.
        """
        other_org = self.create_organization(owner=self.owner)
        with self.feature(FLAG):
            bearer = self._mint_agent_token()
            for silo_mode in (SiloMode.CELL, SiloMode.CONTROL):
                for owner_only in (False, True):
                    with self.subTest(silo_mode=silo_mode.value, owner_only=owner_only):
                        path = "/api/0/organizations/"
                        if owner_only:
                            path += "?owner=1"
                        with assume_test_silo_mode(silo_mode):
                            response = APIClient().get(
                                path,
                                HTTP_AUTHORIZATION=f"Bearer {bearer}",
                            )

                        listed_ids = self._listed_ids(response, nested_organization=owner_only)
                        assert listed_ids == {self.org.id}
                        assert other_org.id not in listed_ids

    def test_revoked_member_invalidates_minted_token(self) -> None:
        with self.feature(FLAG):
            bearer = self._mint_agent_token()
            self.member.delete()

            for silo_mode in (SiloMode.CELL, SiloMode.CONTROL):
                with self.subTest(silo_mode=silo_mode.value):
                    with assume_test_silo_mode(silo_mode):
                        response = APIClient().get(
                            "/api/0/organizations/",
                            HTTP_AUTHORIZATION=f"Bearer {bearer}",
                        )

                    assert response.status_code == 401, response.content

    def test_agent_project_indexes_retain_org_and_member_project_bounds(self) -> None:
        """List endpoints must intersect compatibility identity with credential authority."""
        self.org.flags.allow_joinleave = False
        self.org.save()

        inaccessible_team = self.create_team(organization=self.org)
        inaccessible_project = self.create_project(
            organization=self.org,
            teams=[inaccessible_team],
        )

        other_org = self.create_organization()
        other_team = self.create_team(organization=other_org)
        other_project = self.create_project(organization=other_org, teams=[other_team])

        limited_user = self.create_user()
        self.create_member(
            user=limited_user,
            organization=self.org,
            role="member",
            teams=[self.team],
        )
        self.create_member(
            user=limited_user,
            organization=other_org,
            role="member",
            teams=[other_team],
        )
        self.login_as(limited_user)

        with self.feature(FLAG):
            bearer = self._mint_agent_token()
            client = APIClient()
            global_response = client.get(
                "/api/0/projects/",
                HTTP_AUTHORIZATION=f"Bearer {bearer}",
            )
            organization_response = client.get(
                f"/api/0/organizations/{self.org.slug}/projects/",
                HTTP_AUTHORIZATION=f"Bearer {bearer}",
            )
            cross_org_response = client.get(
                f"/api/0/organizations/{other_org.slug}/projects/",
                HTTP_AUTHORIZATION=f"Bearer {bearer}",
            )

        expected_ids = {self.project.id}
        global_ids = self._listed_ids(global_response)
        organization_ids = self._listed_ids(organization_response)
        with self.subTest(surface="global_project_index"):
            assert global_ids == expected_ids
            assert other_project.id not in global_ids
        with self.subTest(surface="organization_project_index"):
            assert organization_ids == expected_ids
            assert inaccessible_project.id not in organization_ids
        assert cross_org_response.status_code == 403, cross_org_response.content

    def _assert_global_role_agent_resource_breadth(self, role: str) -> None:
        self.org.flags.allow_joinleave = False
        self.org.save()
        unjoined_team = self.create_team(organization=self.org)
        unjoined_project = self.create_project(
            organization=self.org,
            teams=[unjoined_team],
        )

        other_org = self.create_organization()
        other_team = self.create_team(organization=other_org)
        other_project = self.create_project(organization=other_org, teams=[other_team])

        global_user = self.create_user()
        self.create_member(user=global_user, organization=self.org, role=role)
        self.create_member(user=global_user, organization=other_org, role=role)
        self.login_as(global_user)

        with self.feature(FLAG):
            bearer = self._mint_agent_token()
            client = APIClient()
            global_projects_response = client.get(
                "/api/0/projects/",
                HTTP_AUTHORIZATION=f"Bearer {bearer}",
            )
            organization_projects_response = client.get(
                f"/api/0/organizations/{self.org.slug}/projects/",
                HTTP_AUTHORIZATION=f"Bearer {bearer}",
            )
            project_response = client.get(
                f"/api/0/projects/{self.org.slug}/{unjoined_project.slug}/",
                HTTP_AUTHORIZATION=f"Bearer {bearer}",
            )
            team_response = client.get(
                f"/api/0/teams/{self.org.slug}/{unjoined_team.slug}/",
                HTTP_AUTHORIZATION=f"Bearer {bearer}",
            )
            cross_org_response = client.get(
                f"/api/0/projects/{other_org.slug}/{other_project.slug}/",
                HTTP_AUTHORIZATION=f"Bearer {bearer}",
            )

        expected_project_ids = {self.project.id, unjoined_project.id}
        assert self._listed_ids(global_projects_response) == expected_project_ids
        assert self._listed_ids(organization_projects_response) == expected_project_ids
        assert other_project.id not in self._listed_ids(global_projects_response)
        assert project_response.status_code == 200, project_response.content
        assert int(project_response.data["id"]) == unjoined_project.id
        assert team_response.status_code == 200, team_response.content
        assert int(team_response.data["id"]) == unjoined_team.id
        assert cross_org_response.status_code == 403, cross_org_response.content

    def test_manager_agent_inherits_org_wide_resource_access(self) -> None:
        self._assert_global_role_agent_resource_breadth("manager")

    def test_owner_agent_inherits_org_wide_resource_access(self) -> None:
        self._assert_global_role_agent_resource_breadth("owner")

    def _mutation_payload(self, endpoint: PublicMutationEndpoint) -> dict[str, Any]:
        key = (endpoint.endpoint_name, endpoint.method)
        if key == ("SentryAppInstallationExternalIssueActionsEndpoint", "POST"):
            return {"groupId": self._resource("group").id, "action": "link", "uri": "/link"}
        payloads: dict[tuple[str, str], dict[str, Any]] = {
            ("CustomInboundFilterDetailsEndpoint", "PUT"): {
                "name": "Updated permission matrix filter",
                "dataType": "error",
                "conditions": [
                    {"type": "error_message", "operator": "glob", "value": ["TypeError*"]}
                ],
            },
            ("CustomInboundFiltersEndpoint", "POST"): {
                "name": "Permission matrix new filter",
                "dataType": "all",
                "conditions": [{"type": "release", "operator": "glob", "value": ["2.*"]}],
            },
            ("DataForwardingDetailsEndpoint", "PUT"): {
                "provider": "segment",
                "config": {"write_key": "updated-matrix-key"},
                "project_ids": [self.project.id],
            },
            ("DataForwardingIndexEndpoint", "POST"): {
                "provider": "sqs",
                "config": {
                    "queue_url": "https://sqs.us-east-1.amazonaws.com/123456789012/matrix",
                    "region": "us-east-1",
                    "access_key": "matrix-access-key",
                    "secret_key": "matrix-secret-key",
                },
                "project_ids": [],
            },
            ("DiscoverSavedQueriesEndpoint", "POST"): {
                "name": "Permission matrix query mutation",
                "projects": [self.project.id],
                "queryDataset": "error-events",
                "fields": ["title"],
                "query": "is:unresolved",
                "version": 2,
            },
            ("DiscoverSavedQueryDetailEndpoint", "PUT"): {
                "name": "Updated permission matrix query",
                "projects": [self.project.id],
                "queryDataset": "error-events",
                "fields": ["title"],
                "query": "is:resolved",
                "version": 2,
            },
            ("ExternalTeamDetailsEndpoint", "PUT"): {"externalName": "@permission-matrix-updated"},
            ("ExternalTeamEndpoint", "POST"): {
                "externalName": "@permission-matrix-new",
                "provider": "github",
                "integrationId": self._resource("codeowners_integration").id,
            },
            ("ExternalUserDetailsEndpoint", "PUT"): {"externalName": "@permission-matrix-updated"},
            ("ExternalUserEndpoint", "POST"): {
                "externalName": "@permission-matrix-new",
                "provider": "github",
                "userId": self.owner.id,
                "integrationId": self._resource("codeowners_integration").id,
            },
            ("OrganizationDashboardDetailsEndpoint", "PUT"): {
                "title": "Updated permission matrix dashboard"
            },
            ("OrganizationDashboardsEndpoint", "POST"): {
                "title": "Permission matrix dashboard mutation"
            },
            ("OrganizationDetailsEndpoint", "PUT"): {"name": self.org.name},
            ("OrganizationCodeMappingDetailsEndpoint", "PUT"): {
                "repositoryId": self._resource("scm_code_mapping").project_repository.repository_id,
                "projectId": self.project.id,
                "stackRoot": "/app/",
                "sourceRoot": "src/",
                "defaultBranch": "main",
            },
            ("OrganizationCodeMappingsBulkEndpoint", "POST"): {
                "project": self.project.slug,
                "repository": self._resource("scm_repository").name,
                "provider": "github",
                "defaultBranch": "main",
                "mappings": [{"stackRoot": "/app/", "sourceRoot": "src/"}],
            },
            ("OrganizationCodeMappingsEndpoint", "POST"): {
                "integrationId": self._resource(
                    "scm_code_mapping"
                ).project_repository.repository.integration_id,
                "repositoryId": self._resource("scm_code_mapping").project_repository.repository_id,
                "projectId": self.project.id,
                "stackRoot": "/new-app/",
                "sourceRoot": "src/new/",
                "defaultBranch": "main",
            },
            ("OrganizationDetectorIndexEndpoint", "PUT"): {"enabled": False},
            ("OrganizationGroupSearchViewsEndpoint", "POST"): {
                "name": "Permission Matrix Issue View",
                "query": "is:unresolved",
                "querySort": "date",
                "projects": [self.project.id],
                "environments": [],
                "timeFilters": {"period": "14d"},
            },
            ("OrganizationReleaseFileDetailsEndpoint", "PUT"): {"name": "updated-matrix.js"},
            ("OrganizationRepositorySettingsEndpoint", "PUT"): {
                "repositoryIds": [self._resource("scm_repository").id],
                "enabledCodeReview": True,
            },
            ("OrganizationStarredServiceSpansEndpoint", "POST"): {
                "service_span": "permission-matrix-span",
                "project_id": self.project.id,
            },
            ("ProjectReleaseFileDetailsEndpoint", "PUT"): {"name": "updated-matrix.js"},
            ("ProjectReleaseFilesEndpoint", "POST"): {
                "name": "https://example.com/permission-matrix.js"
            },
            ("ProjectCodeOwnersEndpoint", "POST"): {
                "raw": f"src/* {self.owner.email}",
                "codeMappingId": str(self._resource("code_mapping").id),
            },
            ("ProjectCodeOwnersDetailsEndpoint", "PUT"): {
                "raw": f"tests/* {self.owner.email}",
            },
            ("GroupIntegrationDetailsEndpoint", "POST"): {"assignee": "matrix@example.com"},
            ("GroupIntegrationDetailsEndpoint", "PUT"): {"externalIssue": "MATRIX-456"},
            ("OrganizationMemberDetailsEndpoint", "PUT"): {"role": "manager"},
            ("OrganizationMemberIndexEndpoint", "POST"): {
                "email": f"matrix-{uuid4()}@example.com",
                "role": "member",
            },
            ("OrganizationProjectsEndpoint", "POST"): {
                "name": "Permission Matrix Project",
                "team": self.team.slug,
            },
            ("OrganizationProjectDetectorIndexEndpoint", "POST"): {
                "name": "Permission Matrix Detector",
                "type": "metric_issue",
                "dataSources": [
                    {
                        "queryType": SnubaQuery.Type.ERROR.value,
                        "dataset": Dataset.Events.name.lower(),
                        "query": "",
                        "aggregate": "count()",
                        "timeWindow": 3600,
                        "environment": self._resource("environment").name,
                        "eventTypes": [SnubaQueryEventType.EventType.ERROR.name.lower()],
                    }
                ],
                "conditionGroup": {
                    "id": self._resource("detector_condition_group").id,
                    "organizationId": self.org.id,
                    "logicType": self._resource("detector_condition_group").logic_type,
                    "conditions": [
                        {
                            "type": Condition.GREATER,
                            "comparison": 100,
                            "conditionResult": DetectorPriorityLevel.HIGH,
                            "conditionGroupId": self._resource("detector_condition_group").id,
                        },
                        {
                            "type": Condition.LESS_OR_EQUAL,
                            "comparison": 100,
                            "conditionResult": DetectorPriorityLevel.OK,
                            "conditionGroupId": self._resource("detector_condition_group").id,
                        },
                    ],
                },
                "config": {
                    "thresholdPeriod": 1,
                    "detectionType": AlertRuleDetectionType.STATIC.value,
                },
                "workflowIds": [self._resource("workflow").id],
            },
            ("OrganizationMonitorIndexEndpoint", "POST"): {
                "project": self.project.slug,
                "name": "Permission Matrix Monitor",
                "type": "cron_job",
                "config": {"schedule_type": "crontab", "schedule": "@daily"},
            },
            ("NotificationActionsIndexEndpoint", "POST"): {
                "serviceType": "email",
                "triggerType": "audit-log",
                "targetType": "specific",
                "targetDisplay": "Permission matrix",
                "targetIdentifier": self.owner.email,
                "projects": [self.project.slug],
            },
            ("NotificationActionsDetailsEndpoint", "PUT"): {
                "serviceType": "email",
                "triggerType": "audit-log",
                "targetType": "specific",
                "targetDisplay": "Permission matrix",
                "targetIdentifier": self.owner.email,
            },
            ("OrganizationReleasesEndpoint", "POST"): {
                "version": f"matrix-release-{uuid4()}",
                "projects": [self.project.slug],
            },
            ("OrganizationReleaseDetailsEndpoint", "PUT"): {"ref": "permission-matrix-ref"},
            ("OrganizationReleaseFilesEndpoint", "POST"): {
                "name": "https://example.com/permission-matrix.js"
            },
            ("ReleaseDeploysEndpoint", "POST"): {"environment": "production"},
            ("OrganizationTeamsEndpoint", "POST"): {"name": "Permission Matrix Team"},
            ("OrganizationWorkflowIndexEndpoint", "POST"): {
                "name": "Permission Matrix Workflow",
                "enabled": True,
                "config": {},
                "triggers": {"logicType": "any", "conditions": []},
                "actionFilters": [],
            },
            ("OrganizationWorkflowIndexEndpoint", "PUT"): {"enabled": False},
            ("OrganizationWorkflowDetailsEndpoint", "PUT"): {
                "name": "Updated Permission Matrix Workflow",
                "enabled": True,
                "config": {},
                "triggers": {"logicType": "any", "conditions": []},
                "actionFilters": [],
            },
            ("ProjectDetailsEndpoint", "PUT"): {"name": self.project.name},
            ("ProjectEnvironmentDetailsEndpoint", "PUT"): {"name": "production-renamed"},
            ("ProjectEnvironmentsEndpoint", "PUT"): {
                "environmentNames": [self._resource("environment").name],
                "isHidden": True,
            },
            ("ProjectFilterDetailsEndpoint", "PUT"): {"active": True},
            ("ProjectKeyDetailsEndpoint", "PUT"): {"name": "Permission matrix key"},
            ("ProjectKeysEndpoint", "POST"): {"name": "Permission matrix key"},
            ("ProjectOwnershipEndpoint", "PUT"): {"raw": f"* {self.owner.email}"},
            ("ProjectPreprodSizeAnalysisSkipStatusCheckEndpoint", "POST"): {
                "sha": "a" * 40,
                "repository": "owner/not-integrated",
                "provider": "github",
            },
            ("ProjectPreprodSnapshotSkipStatusCheckEndpoint", "POST"): {
                "sha": "a" * 40,
                "repository": "owner/not-integrated",
                "provider": "github",
            },
            ("ProjectPreprodSnapshotEndpoint", "POST"): {
                "app_id": "com.example.permission-matrix",
                "images": {},
            },
            ("ProjectReplayDeletionJobsIndexEndpoint", "POST"): {
                "data": {
                    "rangeStart": (timezone.now() - timedelta(days=2)).isoformat(),
                    "rangeEnd": (timezone.now() - timedelta(days=1)).isoformat(),
                    "environments": ["production"],
                    "query": "",
                }
            },
            ("ProjectRepoEndpoint", "POST"): {"repositoryId": self._resource("repository").id},
            ("ProjectSymbolSourcesEndpoint", "POST"): {
                "name": "Permission matrix new source",
                "layout": {"type": "native"},
                "type": "http",
                "url": "https://new-symbols.example.com",
            },
            ("ProjectSymbolSourcesEndpoint", "PUT"): {
                **self._resource("symbol_source"),
                "name": "Updated permission matrix source",
            },
            ("TeamDetailsEndpoint", "PUT"): {"name": self.team.name},
            ("TeamProjectsEndpoint", "POST"): {"name": "Permission Matrix Team Project"},
        }
        return payloads.get(key, {})

    def _create_matrix_service_account(self) -> None:
        # Before any control-silo override, so the cell replica is written.
        service_account = self.create_service_account(
            organization=self.org,
            name="permission-matrix",
            scope_list=sorted(SERVICE_ACCOUNT_SCOPES),
            project_ids=[self.project.id],
        )
        self._service_account_context = encode_viewer_context(
            ViewerContext(
                actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=service_account.id),
                organization_id=self.org.id,
                project_id=self.project.id,
            ),
            key=SECRET,
        )

    def _assert_service_account_outcome(
        self,
        endpoint: PublicGetEndpoint | PublicMutationEndpoint,
        authorization_oracle: Response,
        response: Response,
    ) -> None:
        matches_oracle = response.status_code == authorization_oracle.status_code and (
            authorization_oracle.status_code < 400
            or response.content == authorization_oracle.content
        )
        assert matches_oracle, (
            endpoint.path_template,
            authorization_oracle.content,
            response.content,
        )

    def _assert_service_account_user_global_get_denied(self, endpoint: PublicGetEndpoint) -> None:
        self._create_matrix_service_account()
        assert endpoint.silo_mode is not None
        with assume_test_silo_mode(endpoint.silo_mode):
            session_response = self.client.get(endpoint.path_template)
            response = self._request(
                endpoint.path_template, MatrixAuthentication.SERVICE_ACCOUNT_VIEWER_CONTEXT
            )

        assert session_response.status_code == 200, session_response.content
        assert response.status_code in {401, 403}, response.content

    def _user_token(self, scopes: frozenset[str] | None = None) -> str:
        with assume_test_silo_mode(SiloMode.CONTROL):
            token = self.create_user_auth_token(
                user=self.owner,
                scope_list=sorted(settings.SENTRY_SCOPES if scopes is None else scopes),
            )
        return token.plaintext_token

    def _request(
        self,
        path: str,
        authentication: MatrixAuthentication,
        *,
        agent_bearer: str | None = None,
        user_token_scopes: frozenset[str] | None = None,
    ) -> Response:
        if authentication is MatrixAuthentication.SESSION:
            return self.client.get(path)

        client = APIClient()
        if authentication is MatrixAuthentication.USER_TOKEN:
            return client.get(
                path,
                HTTP_AUTHORIZATION=f"Bearer {self._user_token(user_token_scopes)}",
            )
        if authentication is MatrixAuthentication.VIEWER_CONTEXT:
            viewer_context = encode_viewer_context(
                ViewerContext(
                    actor=Actor(type=ActorType.USER, actor_id=self.owner.id),
                    organization_id=self.org.id,
                    project_id=self.project.id,
                ),
                key=SECRET,
            )
            return client.get(path, HTTP_X_VIEWER_CONTEXT=viewer_context)
        if authentication is MatrixAuthentication.SERVICE_ACCOUNT_VIEWER_CONTEXT:
            return client.get(path, HTTP_X_VIEWER_CONTEXT=self._service_account_context)
        if authentication in {
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
        }:
            assert agent_bearer is not None
            return client.get(path, HTTP_AUTHORIZATION=f"Bearer {agent_bearer}")
        raise AssertionError(f"unsupported authentication {authentication}")

    def _mutation_request(
        self,
        endpoint: PublicMutationEndpoint,
        path: str,
        payload: dict[str, Any],
        authentication: MatrixAuthentication,
        *,
        agent_bearer: str | None = None,
        user_token_scopes: frozenset[str] | None = None,
    ) -> Response:
        client = self.client if authentication is MatrixAuthentication.SESSION else APIClient()
        headers: dict[str, str] = {}
        if authentication is MatrixAuthentication.USER_TOKEN:
            headers["HTTP_AUTHORIZATION"] = f"Bearer {self._user_token(user_token_scopes)}"
        elif authentication is MatrixAuthentication.VIEWER_CONTEXT:
            headers["HTTP_X_VIEWER_CONTEXT"] = encode_viewer_context(
                ViewerContext(
                    actor=Actor(type=ActorType.USER, actor_id=self.owner.id),
                    organization_id=self.org.id,
                    project_id=self.project.id,
                ),
                key=SECRET,
            )
        elif authentication is MatrixAuthentication.SERVICE_ACCOUNT_VIEWER_CONTEXT:
            headers["HTTP_X_VIEWER_CONTEXT"] = self._service_account_context
        elif authentication in {
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
            MatrixAuthentication.APPROVED_AGENT_TOKEN,
        }:
            assert agent_bearer is not None
            headers["HTTP_AUTHORIZATION"] = f"Bearer {agent_bearer}"

        request_method = getattr(client, endpoint.method.lower())
        request_payload = payload
        request_format = "json"
        if endpoint.endpoint_name in {
            "OrganizationReleaseFilesEndpoint",
            "ProjectReleaseFilesEndpoint",
        }:
            request_payload = {
                **payload,
                "file": SimpleUploadedFile(
                    "permission-matrix.js",
                    b"function permissionMatrix() {}",
                    content_type="application/javascript",
                ),
            }
            request_format = "multipart"
        return request_method(
            path,
            data=request_payload,
            format=request_format,
            **headers,
        )

    def _rolled_back_mutation_request(
        self,
        endpoint: PublicMutationEndpoint,
        path: str,
        payload: dict[str, Any],
        authentication: MatrixAuthentication,
        *,
        agent_bearer: str | None = None,
        user_token_scopes: frozenset[str] | None = None,
    ) -> Response:
        with assume_test_silo_mode(SiloMode.MONOLITH):
            savepoints = {
                database: transaction.savepoint(using=database) for database in settings.DATABASES
            }
        try:
            return self._mutation_request(
                endpoint,
                path,
                payload,
                authentication,
                agent_bearer=agent_bearer,
                user_token_scopes=user_token_scopes,
            )
        finally:
            with assume_test_silo_mode(SiloMode.MONOLITH):
                for database, savepoint in reversed(savepoints.items()):
                    transaction.savepoint_rollback(savepoint, using=database)
            # Model/option cache writes are not transactional. Remove the control
            # request's cached deletion/update so the replay observes the restored DB.
            cache.clear()

    def _assert_public_get_authentication(
        self,
        endpoint: PublicGetEndpoint,
        authentication: MatrixAuthentication,
        *,
        require_actionable_scope_denial: bool = False,
    ) -> None:
        path = self._path(endpoint)
        # Control-silo endpoints must execute in their declared silo, but minting is a
        # cell operation. Mint before changing silo so this tests endpoint behavior rather
        # than the test router trying (and failing) to proxy token creation to a cell.
        agent_bearer = None
        agent_scopes = None
        if authentication in {
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
        }:
            requested_scopes: frozenset[str] | None = (
                frozenset()
                if authentication is MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN
                else None
            )
            with self.feature(FLAG):
                agent_bearer = self._mint_agent_token(requested_scopes=requested_scopes)
            agent_scopes = frozenset(agent_token.decode_agent_token(agent_bearer)["scopes"])
        if authentication is MatrixAuthentication.SERVICE_ACCOUNT_VIEWER_CONTEXT:
            self._create_matrix_service_account()
        if endpoint.endpoint_name == "SeerModelsEndpoint":
            cache.set(SEER_MODELS_CACHE_KEY, {"models": ["matrix-model"]})
            self.addCleanup(cache.delete, SEER_MODELS_CACHE_KEY)
        if endpoint.endpoint_name == "GroupAutofixEndpoint":
            self.org.update_option("sentry:gen_ai_consent_v2024_11_14", True)

        silo_scope = (
            assume_test_silo_mode(endpoint.silo_mode)
            if endpoint.silo_mode is not None
            else nullcontext()
        )
        if endpoint.endpoint_name == "GroupAutofixEndpoint":
            downstream_scope: Any = patch(
                "sentry.seer.endpoints.group_ai_autofix.get_autofix_agent_state",
                return_value=None,
            )
        elif endpoint.endpoint_name == "SentryAppInstallationExternalRequestsEndpoint":
            downstream_scope = patch(
                "sentry.sentry_apps.external_requests.select_requester.SelectRequester.run",
                return_value={"choices": [["1", "Matrix issue"]]},
            )
        elif endpoint.endpoint_name == "OrganizationTraceItemAttributesEndpoint":
            downstream_scope = patch(
                "sentry.api.endpoints.organization_trace_item_attributes."
                "OrganizationTraceItemAttributesEndpoint.query_trace_attributes",
                return_value=([], None),
            )
        elif endpoint.endpoint_name == "OrganizationTraceItemStatsEndpoint":
            downstream_scope = patch(
                "sentry.api.endpoints.organization_trace_item_stats.Spans.run_table_query",
                return_value={"data": []},
            )
        elif endpoint.endpoint_name == "OrganizationIntegrationChannelValidateEndpoint":
            downstream_scope = patch(
                "sentry.integrations.api.endpoints.organization_integration_channel_validate.get_channel_id",
                return_value=SimpleNamespace(channel_id="C123"),
            )
        elif endpoint.endpoint_name in {
            "OrganizationProfilingChunksEndpoint",
            "OrganizationProfilingFlamegraphEndpoint",
        }:
            downstream_scope = patch(
                "sentry.api.endpoints.organization_profiling_profiles.proxy_profiling_service",
                return_value=HttpResponse(status=200),
            )
        elif endpoint.endpoint_name == "ProjectProfilingProfileEndpoint":
            downstream_scope = patch(
                "sentry.api.endpoints.project_profiling_profile.get_from_profiling_service",
                return_value=SimpleNamespace(
                    status=200,
                    data=b'{"metadata":{"version":""}}',
                    headers={},
                ),
            )
        else:
            downstream_scope = nullcontext()
        with silo_scope, downstream_scope, self.feature(self._feature_flags(endpoint)):
            baseline = self.client.get(path)
            authorization_oracle = baseline
            if authentication in {
                MatrixAuthentication.AGENT_TOKEN,
                MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
            }:
                assert agent_scopes is not None
                authorization_oracle = self._request(
                    path,
                    MatrixAuthentication.USER_TOKEN,
                    user_token_scopes=agent_scopes,
                )
            elif authentication is MatrixAuthentication.SERVICE_ACCOUNT_VIEWER_CONTEXT:
                authorization_oracle = self._request(
                    path,
                    MatrixAuthentication.USER_TOKEN,
                    user_token_scopes=SERVICE_ACCOUNT_SCOPES,
                )
            response = (
                baseline
                if authentication is MatrixAuthentication.SESSION
                else self._request(path, authentication, agent_bearer=agent_bearer)
            )

        assert baseline.status_code < 500, baseline.content
        expected_baseline_status = OUTER_BOUNDARY_GET_STATUSES.get(endpoint.endpoint_name, 200)
        assert baseline.status_code == expected_baseline_status, baseline.content
        if authentication is MatrixAuthentication.SERVICE_ACCOUNT_VIEWER_CONTEXT:
            self._assert_service_account_outcome(endpoint, authorization_oracle, response)
            return

        # Successful representations can legitimately differ by credential (for
        # example, an ``access`` field must reflect narrower token scopes), and
        # time-series values can advance between requests. Endpoint-specific tests own
        # payload semantics; this matrix owns authentication and permission outcomes.
        responses_match = response.status_code == authorization_oracle.status_code and (
            authorization_oracle.status_code < 400
            or response.content == authorization_oracle.content
        )
        if require_actionable_scope_denial and authentication in {
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
        }:
            assert agent_scopes is not None
            if not endpoint.allowed_scopes.intersection(agent_scopes):
                assert response.status_code == 403, response.content
                assert response.get("WWW-Authenticate", "").startswith(
                    'Bearer error="insufficient_scope", scope="'
                ), response.items()
        assert responses_match, (
            endpoint.path_template,
            authentication,
            authorization_oracle.content,
            response.content,
        )

    def _assert_public_mutation_authentication(
        self,
        endpoint: PublicMutationEndpoint,
        authentication: MatrixAuthentication,
    ) -> None:
        path = self._path(endpoint)
        payload = self._mutation_payload(endpoint)

        agent_bearer = None
        agent_scopes = None
        if authentication in {
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
            MatrixAuthentication.APPROVED_AGENT_TOKEN,
        }:
            approved_scopes: frozenset[str] = frozenset()
            requested_scopes: frozenset[str] | None = None
            if authentication is MatrixAuthentication.APPROVED_AGENT_TOKEN:
                approved_scopes = frozenset(
                    endpoint.allowed_scopes
                    - agent_token.readonly_scopes()
                    - settings.SENTRY_TOKEN_ONLY_SCOPES
                    # Roles only grant these once their rollout flag is on, so an owner
                    # cannot approve them yet.
                    - settings.GRANULAR_SCOPES
                )
                assert approved_scopes, endpoint
            elif authentication is MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN:
                requested_scopes = frozenset()
            with self.feature(FLAG):
                agent_bearer = self._mint_agent_token(
                    approved_scopes=approved_scopes,
                    requested_scopes=requested_scopes,
                )
            agent_scopes = frozenset(agent_token.decode_agent_token(agent_bearer)["scopes"])
        if authentication is MatrixAuthentication.SERVICE_ACCOUNT_VIEWER_CONTEXT:
            self._create_matrix_service_account()

        silo_scope = (
            assume_test_silo_mode(endpoint.silo_mode)
            if endpoint.silo_mode is not None
            else nullcontext()
        )
        if endpoint.endpoint_name == "GroupAutofixEndpoint":
            downstream_scope: Any = ExitStack()
            downstream_scope.enter_context(
                patch(
                    "sentry.seer.endpoints.group_ai_autofix.trigger_autofix_agent",
                    return_value=SimpleNamespace(seer_run_state_id=1, uuid=uuid4()),
                )
            )
            # Kickoffs are gated on Seer setup (SCM integration + linked repos)
            # mirroring the frontend; that gate is owned by test_group_ai_autofix,
            # so assume a configured project and keep this matrix about auth.
            downstream_scope.enter_context(
                patch(
                    "sentry.seer.endpoints.group_ai_autofix.has_supported_scm_integration",
                    return_value=True,
                )
            )
            downstream_scope.enter_context(
                patch(
                    "sentry.seer.endpoints.group_ai_autofix.has_project_connected_repos",
                    return_value=True,
                )
            )
        elif endpoint.endpoint_name == "SentryAppInstallationExternalIssueActionsEndpoint":
            downstream_scope = patch(
                "sentry.sentry_apps.external_requests.issue_link_requester.IssueLinkRequester.run",
                return_value={
                    "project": "Matrix",
                    "identifier": "1",
                    "webUrl": "https://example.com/issues/1",
                },
            )
        else:
            downstream_scope = nullcontext()
        with silo_scope, downstream_scope, self.feature(self._feature_flags(endpoint)):
            # The session control proves the fixture can execute the operation. Roll it
            # back before replaying the same mutation with each matrix credential.
            baseline = self._rolled_back_mutation_request(
                endpoint,
                path,
                payload,
                MatrixAuthentication.SESSION,
            )

            authorization_oracle = baseline
            if authentication in {
                MatrixAuthentication.AGENT_TOKEN,
                MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
                MatrixAuthentication.APPROVED_AGENT_TOKEN,
            }:
                assert agent_scopes is not None
                authorization_oracle = self._rolled_back_mutation_request(
                    endpoint,
                    path,
                    payload,
                    MatrixAuthentication.USER_TOKEN,
                    user_token_scopes=agent_scopes,
                )
            elif authentication is MatrixAuthentication.SERVICE_ACCOUNT_VIEWER_CONTEXT:
                authorization_oracle = self._rolled_back_mutation_request(
                    endpoint,
                    path,
                    payload,
                    MatrixAuthentication.USER_TOKEN,
                    user_token_scopes=SERVICE_ACCOUNT_SCOPES,
                )

            response = (
                baseline
                if authentication is MatrixAuthentication.SESSION
                else self._rolled_back_mutation_request(
                    endpoint,
                    path,
                    payload,
                    authentication,
                    agent_bearer=agent_bearer,
                )
            )

        assert baseline.status_code < 500, baseline.content
        outer_status = OUTER_BOUNDARY_MUTATION_STATUSES.get(
            (endpoint.endpoint_name, endpoint.method)
        )
        if outer_status is None:
            assert baseline.status_code < 400, (
                endpoint.endpoint_name,
                endpoint.method,
                baseline.content,
            )
        else:
            assert baseline.status_code == outer_status, baseline.content
        if authentication is MatrixAuthentication.SERVICE_ACCOUNT_VIEWER_CONTEXT:
            self._assert_service_account_outcome(endpoint, authorization_oracle, response)
            return

        if (
            authentication is MatrixAuthentication.APPROVED_AGENT_TOKEN
            and (endpoint.endpoint_name, endpoint.method) in AGENT_SUDO_BOUNDARY_MUTATIONS
        ):
            assert authorization_oracle.status_code < 400, authorization_oracle.content
            assert response.status_code == 401, response.content
            assert response.data["detail"]["code"] == "sudo-required"
            return

        responses_match = response.status_code == authorization_oracle.status_code and (
            authorization_oracle.status_code < 400
            or response.content == authorization_oracle.content
        )
        if authentication in {
            MatrixAuthentication.AGENT_TOKEN,
            MatrixAuthentication.SCOPED_DOWN_AGENT_TOKEN,
        }:
            assert agent_scopes is not None
            if not endpoint.allowed_scopes.intersection(agent_scopes):
                correctly_denied = response.status_code == 403 and response.get(
                    "WWW-Authenticate", ""
                ).startswith('Bearer error="insufficient_scope"')
                assert correctly_denied, response.content

        assert responses_match, (
            endpoint.path_template,
            endpoint.method,
            authentication,
            authorization_oracle.content,
            response.content,
        )


def _mark_service_account_gap[F: Callable[..., None]](test: F, test_id: str) -> F:
    # Until service account auth lands (#128779), service account requests are anonymous.
    if not hasattr(access, "ServiceAccountAccess"):
        return pytest.mark.xfail(reason="service account auth isn't supported yet")(test)
    gap = SERVICE_ACCOUNT_KNOWN_GAPS.get(test_id)
    if gap is None:
        return test
    return pytest.mark.xfail(strict=True, reason=gap.value)(test)


def _install_public_get_matrix_tests() -> None:
    """Generate real unittest methods because pytest cannot parametrize APITestCase."""

    for index, (endpoint, authentication) in enumerate(_matrix_cases()):

        def test_matrix_cell(
            self: AgentTokenPublicGetMatrixTest,
            endpoint: PublicGetEndpoint = endpoint,
            authentication: MatrixAuthentication = authentication,
        ) -> None:
            self._assert_public_get_authentication(endpoint, authentication)

        test_matrix_cell.__name__ = (
            f"test_public_get_{index:03d}_{endpoint.test_id}_{authentication.value}"
        )
        if authentication is MatrixAuthentication.SERVICE_ACCOUNT_VIEWER_CONTEXT:
            test_matrix_cell = _mark_service_account_gap(test_matrix_cell, endpoint.test_id)
        setattr(AgentTokenPublicGetMatrixTest, test_matrix_cell.__name__, test_matrix_cell)


_install_public_get_matrix_tests()


def _install_public_mutation_matrix_tests() -> None:
    for index, (endpoint, authentication) in enumerate(_mutation_matrix_cases()):

        def test_matrix_cell(
            self: AgentTokenPublicGetMatrixTest,
            endpoint: PublicMutationEndpoint = endpoint,
            authentication: MatrixAuthentication = authentication,
        ) -> None:
            self._assert_public_mutation_authentication(endpoint, authentication)

        test_matrix_cell.__name__ = (
            f"test_public_mutation_{index:03d}_{endpoint.test_id}_{authentication.value}"
        )
        if authentication is MatrixAuthentication.SERVICE_ACCOUNT_VIEWER_CONTEXT:
            test_matrix_cell = _mark_service_account_gap(test_matrix_cell, endpoint.test_id)
        setattr(AgentTokenPublicGetMatrixTest, test_matrix_cell.__name__, test_matrix_cell)


_install_public_mutation_matrix_tests()


def _install_private_helper_matrix_tests() -> None:
    for index, (get_endpoint, get_authentication) in enumerate(_private_helper_get_matrix_cases()):

        def test_get_matrix_cell(
            self: AgentTokenPublicGetMatrixTest,
            endpoint: PublicGetEndpoint = get_endpoint,
            authentication: MatrixAuthentication = get_authentication,
        ) -> None:
            self._assert_public_get_authentication(
                endpoint,
                authentication,
                require_actionable_scope_denial=True,
            )

        test_get_matrix_cell.__name__ = (
            f"test_private_helper_get_{index:03d}_{get_endpoint.test_id}_{get_authentication.value}"
        )
        if get_authentication is MatrixAuthentication.SERVICE_ACCOUNT_VIEWER_CONTEXT:
            test_get_matrix_cell = _mark_service_account_gap(
                test_get_matrix_cell, get_endpoint.test_id
            )
        setattr(AgentTokenPublicGetMatrixTest, test_get_matrix_cell.__name__, test_get_matrix_cell)


_install_private_helper_matrix_tests()


def _install_service_account_user_global_matrix_tests() -> None:
    for index, endpoint in enumerate(USER_GLOBAL_GET_ENDPOINTS):

        def test_matrix_cell(
            self: AgentTokenPublicGetMatrixTest,
            endpoint: PublicGetEndpoint = endpoint,
        ) -> None:
            self._assert_service_account_user_global_get_denied(endpoint)

        test_matrix_cell.__name__ = (
            f"test_user_global_get_{index:03d}_{endpoint.test_id}_service_account_viewer_context"
        )
        setattr(AgentTokenPublicGetMatrixTest, test_matrix_cell.__name__, test_matrix_cell)


_install_service_account_user_global_matrix_tests()
