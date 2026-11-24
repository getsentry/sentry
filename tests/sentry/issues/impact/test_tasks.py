from __future__ import annotations

from collections.abc import Sequence
from typing import Any
from unittest.mock import MagicMock, patch

from sentry.constants import ObjectStatus
from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.issues.impact.tasks import (
    run_impact_assessments_for_project,
    schedule_impact_assessments,
    select_impact_candidates,
)
from sentry.issues.impact.types import IMPACT_FEATURE_ID
from sentry.models.group import Group, GroupStatus
from sentry.models.organization import OrganizationStatus
from sentry.models.project import Project
from sentry.testutils.cases import OccurrenceTestCase, SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.helpers.options import override_options

TASKS = "sentry.issues.impact.tasks"
FLAG = "organizations:seer-impact-assessment"


def _enabled(**overrides: object) -> dict[str, object]:
    return {
        "issues.impact.scheduled.enable": True,
        "issues.impact.scheduled.issues_per_project": 5,
        "issues.impact.scheduled.max_dispatches_per_org_per_day": 500,
        **overrides,
    }


@patch(f"{TASKS}.run_impact_assessments_for_project.apply_async")
class ScheduleImpactAssessmentsTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.create_group(project=self.project)

    def _active_project(self, **kwargs: Any) -> Project:
        project = self.create_project(**kwargs)
        self.create_group(project=project)
        return project

    def _dispatched(self, mock_apply: MagicMock) -> list[int]:
        return sorted(c.kwargs["args"][0] for c in mock_apply.call_args_list)

    def _schedule(
        self, organization_ids: Sequence[int] = (), project_ids: Sequence[int] = ()
    ) -> None:
        with (
            self.feature(FLAG),
            override_options(
                _enabled(
                    **{
                        "issues.impact.scheduled.organization_ids": list(organization_ids),
                        "issues.impact.scheduled.project_ids": list(project_ids),
                    }
                )
            ),
        ):
            schedule_impact_assessments()

    def test_disabled_does_nothing(self, mock_apply: MagicMock) -> None:
        with (
            self.feature(FLAG),
            override_options({"issues.impact.scheduled.project_ids": [self.project.id]}),
        ):
            schedule_impact_assessments()
        mock_apply.assert_not_called()

    def test_nothing_listed(self, mock_apply: MagicMock) -> None:
        self._schedule()
        mock_apply.assert_not_called()

    def test_dispatches_listed_projects(self, mock_apply: MagicMock) -> None:
        other = self._active_project(organization=self.create_organization())
        self._active_project()  # unlisted
        self._schedule(project_ids=[self.project.id, other.id])
        assert self._dispatched(mock_apply) == sorted([self.project.id, other.id])
        for c in mock_apply.call_args_list:
            assert 0 <= c.kwargs["countdown"] < 50 * 60

    def test_dispatches_every_project_in_listed_orgs(self, mock_apply: MagicMock) -> None:
        second = self._active_project()
        self._active_project(organization=self.create_organization())  # unlisted org
        self._schedule(organization_ids=[self.organization.id])
        assert self._dispatched(mock_apply) == sorted([self.project.id, second.id])

    def test_combines_orgs_and_projects_without_duplicates(self, mock_apply: MagicMock) -> None:
        other = self._active_project(organization=self.create_organization())
        self._schedule(
            organization_ids=[self.organization.id], project_ids=[self.project.id, other.id]
        )
        assert self._dispatched(mock_apply) == sorted([self.project.id, other.id])

    def test_skips_projects_without_recent_unresolved_issues(self, mock_apply: MagicMock) -> None:
        stale = self.create_project()
        self.create_group(project=stale, last_seen=before_now(hours=30))
        resolved = self.create_project()
        self.create_group(project=resolved, status=GroupStatus.RESOLVED)
        self.create_project()  # no issues at all
        self._schedule(organization_ids=[self.organization.id])
        assert self._dispatched(mock_apply) == [self.project.id]

    def test_skips_orgs_without_flag(self, mock_apply: MagicMock) -> None:
        other_org = self.create_organization()
        other = self._active_project(organization=other_org)
        with (
            patch(
                f"{TASKS}.features.batch_has_for_organizations",
                return_value={
                    f"organization:{self.organization.id}": True,
                    f"organization:{other_org.id}": False,
                },
            ),
            override_options(
                _enabled(**{"issues.impact.scheduled.project_ids": [self.project.id, other.id]})
            ),
        ):
            schedule_impact_assessments()
        assert self._dispatched(mock_apply) == [self.project.id]

    def test_queues_when_batch_flag_check_unavailable(self, mock_apply: MagicMock) -> None:
        with (
            patch(f"{TASKS}.features.batch_has_for_organizations", return_value=None),
            override_options(
                _enabled(**{"issues.impact.scheduled.project_ids": [self.project.id]})
            ),
        ):
            schedule_impact_assessments()
        assert self._dispatched(mock_apply) == [self.project.id]

    def test_skips_inactive_projects(self, mock_apply: MagicMock) -> None:
        self.project.update(status=ObjectStatus.PENDING_DELETION)
        self._schedule(organization_ids=[self.organization.id], project_ids=[self.project.id])
        mock_apply.assert_not_called()


@with_feature(FLAG)
@patch(f"{TASKS}.quotas.backend.check_seer_quota", return_value=True)
@patch(f"{TASKS}.assess_impact_for_group")
@patch(f"{TASKS}.select_impact_candidates")
class RunImpactAssessmentsForProjectTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.groups = [self.create_group(project=self.project) for _ in range(3)]

    def test_dispatches_candidates(
        self, mock_select: MagicMock, mock_assess: MagicMock, mock_quota: MagicMock
    ) -> None:
        mock_select.return_value = self.groups
        with override_options(_enabled(**{"issues.impact.scheduled.issues_per_project": 7})):
            run_impact_assessments_for_project(self.project.id)
        mock_select.assert_called_once_with(project=self.project, limit=7)
        assert [c.kwargs["group"] for c in mock_assess.call_args_list] == self.groups

    def test_disabled(
        self, mock_select: MagicMock, mock_assess: MagicMock, mock_quota: MagicMock
    ) -> None:
        mock_select.return_value = self.groups
        run_impact_assessments_for_project(self.project.id)
        mock_assess.assert_not_called()

    def test_inactive_project(
        self, mock_select: MagicMock, mock_assess: MagicMock, mock_quota: MagicMock
    ) -> None:
        self.project.update(status=ObjectStatus.PENDING_DELETION)
        mock_select.return_value = self.groups
        with override_options(_enabled()):
            run_impact_assessments_for_project(self.project.id)
        mock_assess.assert_not_called()

    def test_inactive_org(
        self, mock_select: MagicMock, mock_assess: MagicMock, mock_quota: MagicMock
    ) -> None:
        self.organization.update(status=OrganizationStatus.PENDING_DELETION)
        mock_select.return_value = self.groups
        with override_options(_enabled()):
            run_impact_assessments_for_project(self.project.id)
        mock_assess.assert_not_called()

    def test_no_quota(
        self, mock_select: MagicMock, mock_assess: MagicMock, mock_quota: MagicMock
    ) -> None:
        mock_quota.return_value = False
        mock_select.return_value = self.groups
        with override_options(_enabled()):
            run_impact_assessments_for_project(self.project.id)
        mock_assess.assert_not_called()

    def test_hide_ai_features(
        self, mock_select: MagicMock, mock_assess: MagicMock, mock_quota: MagicMock
    ) -> None:
        self.organization.update_option("sentry:hide_ai_features", True)
        mock_select.return_value = self.groups
        with override_options(_enabled()):
            run_impact_assessments_for_project(self.project.id)
        mock_assess.assert_not_called()

    def test_feature_disabled(
        self, mock_select: MagicMock, mock_assess: MagicMock, mock_quota: MagicMock
    ) -> None:
        mock_select.return_value = self.groups
        with self.feature({FLAG: False}), override_options(_enabled()):
            run_impact_assessments_for_project(self.project.id)
        mock_assess.assert_not_called()

    def test_daily_cap(
        self, mock_select: MagicMock, mock_assess: MagicMock, mock_quota: MagicMock
    ) -> None:
        mock_select.return_value = self.groups
        with override_options(
            _enabled(**{"issues.impact.scheduled.max_dispatches_per_org_per_day": 2})
        ):
            run_impact_assessments_for_project(self.project.id)
            assert mock_assess.call_count == 2
            # The cap persists across runs within the same day.
            run_impact_assessments_for_project(self.project.id)
            assert mock_assess.call_count == 2

    def test_run_without_candidates_uses_no_cap(
        self, mock_select: MagicMock, mock_assess: MagicMock, mock_quota: MagicMock
    ) -> None:
        with override_options(
            _enabled(**{"issues.impact.scheduled.max_dispatches_per_org_per_day": 1})
        ):
            mock_select.return_value = []
            run_impact_assessments_for_project(self.project.id)
            mock_select.return_value = self.groups
            run_impact_assessments_for_project(self.project.id)
        assert mock_assess.call_count == 1

    def test_org_daily_cap_spans_projects(
        self, mock_select: MagicMock, mock_assess: MagicMock, mock_quota: MagicMock
    ) -> None:
        other = self.create_project()
        mock_select.return_value = self.groups
        with override_options(
            _enabled(**{"issues.impact.scheduled.max_dispatches_per_org_per_day": 4})
        ):
            run_impact_assessments_for_project(self.project.id)
            run_impact_assessments_for_project(other.id)
        assert mock_assess.call_count == 4

    def test_org_daily_cap_is_per_org(
        self, mock_select: MagicMock, mock_assess: MagicMock, mock_quota: MagicMock
    ) -> None:
        other = self.create_project(organization=self.create_organization())
        mock_select.return_value = self.groups
        with override_options(
            _enabled(**{"issues.impact.scheduled.max_dispatches_per_org_per_day": 2})
        ):
            run_impact_assessments_for_project(self.project.id)
            run_impact_assessments_for_project(other.id)
        assert mock_assess.call_count == 4

    def test_cap_of_zero_pauses(
        self, mock_select: MagicMock, mock_assess: MagicMock, mock_quota: MagicMock
    ) -> None:
        mock_select.return_value = self.groups
        with override_options(
            _enabled(**{"issues.impact.scheduled.max_dispatches_per_org_per_day": 0})
        ):
            run_impact_assessments_for_project(self.project.id)
        mock_assess.assert_not_called()

    def test_one_failure_does_not_stop_the_rest(
        self, mock_select: MagicMock, mock_assess: MagicMock, mock_quota: MagicMock
    ) -> None:
        mock_select.return_value = self.groups
        mock_assess.side_effect = [RuntimeError("boom"), None, None]
        with override_options(_enabled()):
            run_impact_assessments_for_project(self.project.id)
        assert mock_assess.call_count == 3


class SelectImpactCandidatesTest(TestCase, SnubaTestCase, OccurrenceTestCase):
    def _store(self, count: int, project: Project | None = None, **group_kwargs: Any) -> Group:
        project = project or self.project
        group = self.create_group(project=project, **group_kwargs)
        self.store_eap_items(
            [
                self.create_eap_occurrence(
                    organization=project.organization,
                    project=project,
                    group_id=group.id,
                    timestamp=before_now(minutes=5),
                )
                for _ in range(count)
            ]
        )
        return group

    def _mark_assessed(self, group: Group) -> None:
        run = self.create_seer_run(organization=self.organization)
        self.create_seer_agent_run(run=run, source=IMPACT_FEATURE_ID, group=group)

    def test_ranks_by_event_count(self) -> None:
        low = self._store(1)
        high = self._store(3)
        mid = self._store(2)
        assert select_impact_candidates(self.project, 10) == [high, mid, low]
        assert select_impact_candidates(self.project, 2) == [high, mid]

    def test_includes_non_error_issues(self) -> None:
        error = self._store(1)
        performance = self._store(2, type=PerformanceNPlusOneGroupType.type_id)
        assert select_impact_candidates(self.project, 10) == [performance, error]

    def test_excludes_already_assessed(self) -> None:
        low = self._store(1)
        high = self._store(3)
        self._mark_assessed(high)
        assert select_impact_candidates(self.project, 10) == [low]

    def test_excludes_resolved(self) -> None:
        low = self._store(1)
        high = self._store(3)
        high.update(status=GroupStatus.RESOLVED)
        assert select_impact_candidates(self.project, 10) == [low]

    def test_ignores_old_occurrences(self) -> None:
        recent = self._store(1)
        old = self.create_group(project=self.project)
        self.store_eap_items(
            [
                self.create_eap_occurrence(group_id=old.id, timestamp=before_now(hours=30))
                for _ in range(3)
            ]
        )
        assert select_impact_candidates(self.project, 10) == [recent]

    def test_scoped_to_project(self) -> None:
        self._store(3, project=self.create_project())
        mine = self._store(1)
        assert select_impact_candidates(self.project, 10) == [mine]

    def test_pages_past_assessed_issues(self) -> None:
        # With limit=1 a page holds 5 ranked issues; assess all of the first page.
        first_page = [self._store(count) for count in range(10, 5, -1)]
        for group in first_page:
            self._mark_assessed(group)
        next_best = self._store(5)
        self._store(4)
        assert select_impact_candidates(self.project, 1) == [next_best]

    @patch(f"{TASKS}.MAX_CANDIDATE_PAGES", 1)
    def test_stops_after_max_pages(self) -> None:
        first_page = [self._store(count) for count in range(10, 5, -1)]
        for group in first_page:
            self._mark_assessed(group)
        self._store(5)
        assert select_impact_candidates(self.project, 1) == []

    def test_zero_limit(self) -> None:
        self._store(1)
        assert select_impact_candidates(self.project, 0) == []
