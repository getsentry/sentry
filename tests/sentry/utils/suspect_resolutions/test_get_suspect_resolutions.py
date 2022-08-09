from datetime import datetime, timedelta
from unittest import mock

from django.utils import timezone

from sentry.models import Activity, Group, GroupStatus
from sentry.signals import issue_resolved
from sentry.testutils import TestCase
from sentry.types.activity import ActivityType
from sentry.utils.suspect_resolutions.get_suspect_resolutions import get_suspect_resolutions
from sentry.utils.suspect_resolutions.metric_correlation import MetricCorrelationResult


class GetSuspectResolutionsTest(TestCase):
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_commit_correlated",
        mock.Mock(return_value=(True, [], [])),
    )
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_error_rate_correlated",
        mock.Mock(
            return_value=(
                [(MetricCorrelationResult(0, True, 0.5))],
                timezone.now(),
                timezone.now() - timedelta(days=1),
                timezone.now() - timedelta(hours=2),
            )
        ),
    )
    def test_get_suspect_resolutions(self):
        project = self.create_project()
        resolved_issue = self.create_group(
            status=GroupStatus.RESOLVED,
            resolved_at=timezone.now(),
            project=project,
            last_seen=timezone.now() - timedelta(hours=2),
        )
        Activity.objects.create(
            project=project, group=resolved_issue, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
        )

        assert get_suspect_resolutions(resolved_issue.id) == [0]

    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_commit_correlated",
        mock.Mock(return_value=(False, [], [])),
    )
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_error_rate_correlated",
        mock.Mock(
            return_value=(
                [(MetricCorrelationResult(0, True, 0.5))],
                timezone.now(),
                timezone.now() - timedelta(days=1),
                timezone.now() - timedelta(hours=2),
            )
        ),
    )
    def test_get_suspect_resolutions_uncorrelated_commit_data(self):
        project = self.create_project()
        resolved_issue = self.create_group(
            status=GroupStatus.RESOLVED, resolved_at=timezone.now(), project=project
        )
        self.create_group(project=project, status=GroupStatus.UNRESOLVED)

        assert get_suspect_resolutions(resolved_issue.id) == []

    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_commit_correlated",
        mock.Mock(return_value=(True, [], [])),
    )
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_error_rate_correlated",
        mock.Mock(
            return_value=(
                [(MetricCorrelationResult(0, False, 0.2))],
                timezone.now(),
                timezone.now() - timedelta(days=1),
                timezone.now() - timedelta(hours=2),
            )
        ),
    )
    def test_get_suspect_resolutions_uncorrelated_metric_data(self):
        project = self.create_project()
        resolved_issue = self.create_group(
            status=GroupStatus.RESOLVED, resolved_at=timezone.now(), project=project
        )

        assert get_suspect_resolutions(resolved_issue.id) == []

    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_commit_correlated",
        mock.Mock(return_value=(False, [], [])),
    )
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_error_rate_correlated",
        mock.Mock(
            return_value=(
                [(MetricCorrelationResult(0, False, 0.2))],
                timezone.now(),
                timezone.now() - timedelta(days=1),
                timezone.now() - timedelta(hours=2),
            )
        ),
    )
    def test_get_suspect_resolutions_uncorrelated_data(self):
        project = self.create_project()
        resolved_issue = self.create_group(
            status=GroupStatus.RESOLVED, resolved_at=timezone.now(), project=project
        )

        assert get_suspect_resolutions(resolved_issue.id) == []

    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_commit_correlated",
        mock.Mock(return_value=(False, [], [])),
    )
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_error_rate_correlated",
        mock.Mock(return_value=([])),
    )
    def test_get_suspect_resolutions_issue_unresolved(self):
        project = self.create_project()
        unresolved_issue = self.create_group(project=project, status=GroupStatus.UNRESOLVED)

        assert get_suspect_resolutions(unresolved_issue.id) == []

    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_commit_correlated",
        mock.Mock(return_value=(False, [], [])),
    )
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_error_rate_correlated",
        mock.Mock(return_value=([])),
    )
    def test_get_suspect_resolutions_no_other_issues_in_project(self):
        project = self.create_project()
        resolved_issue = self.create_group(project=project, status=GroupStatus.RESOLVED)

        assert get_suspect_resolutions(resolved_issue.id) == []

    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_commit_correlated",
        mock.Mock(return_value=(True, [1, 2], [3, 4])),
    )
    @mock.patch(
        "sentry.utils.suspect_resolutions.get_suspect_resolutions.is_issue_error_rate_correlated",
        mock.Mock(
            return_value=(
                [(MetricCorrelationResult(0, True, 0.5))],
                datetime(2022, 1, 3),
                datetime(2022, 1, 2),
                datetime(2022, 1, 1),
            )
        ),
    )
    @mock.patch("sentry.analytics.record")
    def test_suspect_resolutions_evaluation_analytics_event(self, record):
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        resolved_issue = Group.objects.create(status=GroupStatus.RESOLVED, project=project)
        resolution_type = Activity.objects.create(
            project=project, group=resolved_issue, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
        )
        get_suspect_resolutions(resolved_issue.id)

        notification_record = [
            r for r in record.call_args_list if r[0][0] == "suspect_resolution.evaluation"
        ]

        assert notification_record == [
            mock.call(
                "suspect_resolution.evaluation",
                resolved_group_id=resolved_issue.id,
                candidate_group_id=0,
                resolved_group_resolution_type=resolution_type.type,
                pearson_r_coefficient=0.5,
                pearson_r_start_time=datetime(2022, 1, 2),
                pearson_r_end_time=datetime(2022, 1, 1),
                pearson_r_resolution_time=datetime(2022, 1, 3),
                is_commit_correlated=True,
                resolved_issue_release_ids=[1, 2],
                candidate_issue_release_ids=[3, 4],
            )
        ]

    @mock.patch("sentry.utils.suspect_resolutions.get_suspect_resolutions.get_suspect_resolutions")
    def test_record_suspect_resolutions(self, mock_record_suspect_resolutions):
        organization = self.create_organization()
        project = self.create_project(organization=organization)
        user = self.create_user()
        resolved_issue = self.create_group(project=project)
        resolution_type = Activity.objects.create(
            project=project, group=resolved_issue, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
        )

        with self.feature("projects:suspect-resolutions"):
            issue_resolved.send(
                organization_id=organization.id,
                project=project,
                group=resolved_issue,
                user=user,
                resolution_type=resolution_type.type,
                sender=type(self.project),
            )

        assert len(mock_record_suspect_resolutions.mock_calls) == 1
