from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.models import Activity, GroupStatus
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

        assert get_suspect_resolutions(resolved_issue) == [0]

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

        assert get_suspect_resolutions(resolved_issue) == []

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

        assert get_suspect_resolutions(resolved_issue) == []

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

        assert get_suspect_resolutions(resolved_issue) == []

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

        assert get_suspect_resolutions(unresolved_issue) == []

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

        assert get_suspect_resolutions(resolved_issue) == []
