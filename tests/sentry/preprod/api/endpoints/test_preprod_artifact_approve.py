from unittest.mock import MagicMock, patch

from django.test import override_settings
from django.urls import reverse

from sentry.preprod.analytics import PreprodStatusCheckApprovalCreatedEvent
from sentry.preprod.models import PreprodComparisonApproval
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.analytics import (
    assert_any_analytics_event,
    assert_not_analytics_event,
)
from sentry.testutils.helpers.features import with_feature
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context


class OrganizationPreprodArtifactApproveTest(APITestCase):
    def setUp(self) -> None:
        super().setUp()
        self.owner = self.create_user()
        self.org = self.create_organization(owner=self.owner)
        self.org.flags.allow_joinleave = False
        self.org.save()

        self.team_a = self.create_team(organization=self.org, slug="team-a")
        self.team_b = self.create_team(organization=self.org, slug="team-b")

        self.project_b = self.create_project(organization=self.org, teams=[self.team_b])
        self.artifact = self.create_preprod_artifact(project=self.project_b)

        self.outsider = self.create_user(is_superuser=False)
        self.create_member(
            user=self.outsider, organization=self.org, role="member", teams=[self.team_a]
        )

    def _approve_url(self, artifact_id):
        return reverse(
            "sentry-api-0-organization-preprod-artifact-approve",
            args=[self.org.slug, artifact_id],
        )

    def test_approve_returns_404_for_member_without_project_access(
        self,
    ) -> None:
        self.login_as(user=self.outsider)

        response = self.client.post(
            self._approve_url(self.artifact.id),
            data={"feature_type": "size"},
            format="json",
        )

        assert response.status_code == 404

    @patch("sentry.preprod.api.endpoints.preprod_artifact_approve.create_preprod_status_check_task")
    @patch("sentry.analytics.record")
    def test_approve_size_records_analytics(self, mock_analytics, mock_task) -> None:
        self.login_as(user=self.owner)

        response = self.client.post(
            self._approve_url(self.artifact.id),
            data={"feature_type": "size"},
            format="json",
        )

        assert response.status_code == 201
        assert_any_analytics_event(
            mock_analytics,
            PreprodStatusCheckApprovalCreatedEvent(
                organization_id=self.org.id,
                project_id=self.project_b.id,
                artifact_id=self.artifact.id,
                product="size",
                source="web",
            ),
        )

    @patch("sentry.preprod.api.endpoints.preprod_artifact_approve.create_preprod_status_check_task")
    @override_settings(SEER_API_SHARED_SECRET="service-account-secret")
    @with_feature("organizations:service-accounts")
    def test_service_account_approves_with_no_approver(self, mock_task: MagicMock) -> None:
        service_account = self.create_service_account(
            organization=self.org, scope_list=["project:releases"], project_ids=[self.project_b.id]
        )
        viewer_context = encode_viewer_context(
            ViewerContext(
                actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=service_account.id),
                organization_id=self.org.id,
            ),
            key="service-account-secret",
        )

        response = self.client.post(
            self._approve_url(self.artifact.id),
            data={"feature_type": "size"},
            format="json",
            HTTP_X_VIEWER_CONTEXT=viewer_context,
        )

        assert response.status_code == 201, response.content
        approval = PreprodComparisonApproval.objects.get(preprod_artifact=self.artifact)
        assert approval.approval_status == PreprodComparisonApproval.ApprovalStatus.APPROVED
        assert approval.approved_by_id is None

    @patch("sentry.preprod.api.endpoints.preprod_artifact_approve.update_preprod_snapshot_vcs")
    @patch("sentry.analytics.record")
    def test_approve_snapshots_records_analytics(self, mock_analytics, mock_task) -> None:
        self.login_as(user=self.owner)

        response = self.client.post(
            self._approve_url(self.artifact.id),
            data={"feature_type": "snapshots"},
            format="json",
        )

        assert response.status_code == 201
        assert_any_analytics_event(
            mock_analytics,
            PreprodStatusCheckApprovalCreatedEvent(
                organization_id=self.org.id,
                project_id=self.project_b.id,
                artifact_id=self.artifact.id,
                product="snapshots",
                source="web",
            ),
        )

    @patch("sentry.preprod.api.endpoints.preprod_artifact_approve.create_preprod_status_check_task")
    @patch("sentry.analytics.record")
    def test_already_approved_does_not_record_analytics(self, mock_analytics, mock_task) -> None:
        self.login_as(user=self.owner)
        self.create_preprod_comparison_approval(
            preprod_artifact=self.artifact,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SIZE,
            approved_by_id=self.owner.id,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        )

        response = self.client.post(
            self._approve_url(self.artifact.id),
            data={"feature_type": "size"},
            format="json",
        )

        assert response.status_code == 200
        assert_not_analytics_event(mock_analytics, PreprodStatusCheckApprovalCreatedEvent)
        mock_task.assert_called_once_with(
            preprod_artifact_id=self.artifact.id, caller="approval_endpoint"
        )

    @patch("sentry.preprod.api.endpoints.preprod_artifact_approve.update_preprod_snapshot_vcs")
    @patch("sentry.analytics.record")
    def test_already_approved_snapshots_resyncs_vcs(self, mock_analytics, mock_update_vcs) -> None:
        self.login_as(user=self.owner)
        self.create_preprod_comparison_approval(
            preprod_artifact=self.artifact,
            preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
            approved_by_id=self.owner.id,
            approval_status=PreprodComparisonApproval.ApprovalStatus.APPROVED,
        )

        response = self.client.post(
            self._approve_url(self.artifact.id),
            data={"feature_type": "snapshots"},
            format="json",
        )

        assert response.status_code == 200
        mock_update_vcs.assert_called_once_with(
            preprod_artifact_id=self.artifact.id, caller="approval_endpoint"
        )
        assert_not_analytics_event(mock_analytics, PreprodStatusCheckApprovalCreatedEvent)
        assert (
            PreprodComparisonApproval.objects.filter(
                preprod_artifact=self.artifact,
                preprod_feature_type=PreprodComparisonApproval.FeatureType.SNAPSHOTS,
            ).count()
            == 1
        )

    @patch("sentry.analytics.record")
    def test_invalid_feature_type_does_not_record_analytics(self, mock_analytics) -> None:
        self.login_as(user=self.owner)

        response = self.client.post(
            self._approve_url(self.artifact.id),
            data={"feature_type": "bogus"},
            format="json",
        )

        assert response.status_code == 400
        assert_not_analytics_event(mock_analytics, PreprodStatusCheckApprovalCreatedEvent)
