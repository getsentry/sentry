from sentry.models.group import GroupStatus
from sentry.workflow_engine.models.detector_group import get_open_issues_counts
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class GetOpenIssuesCountsTest(BaseWorkflowTest):
    def test_empty_detector_ids(self) -> None:
        assert get_open_issues_counts([]) == {}

    def test_no_groups(self) -> None:
        detector = self.create_detector()
        assert get_open_issues_counts([detector.id]) == {}

    def test_counts_unresolved_groups(self) -> None:
        detector = self.create_detector()
        group1 = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
        group2 = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
        self.create_detector_group(detector=detector, group=group1)
        self.create_detector_group(detector=detector, group=group2)

        result = get_open_issues_counts([detector.id])
        assert result == {detector.id: 2}

    def test_excludes_resolved_groups(self) -> None:
        detector = self.create_detector()
        unresolved = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
        resolved = self.create_group(project=self.project, status=GroupStatus.RESOLVED)
        self.create_detector_group(detector=detector, group=unresolved)
        self.create_detector_group(detector=detector, group=resolved)

        result = get_open_issues_counts([detector.id])
        assert result == {detector.id: 1}

    def test_multiple_detectors(self) -> None:
        detector1 = self.create_detector()
        detector2 = self.create_detector()
        group1 = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
        group2 = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
        group3 = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
        self.create_detector_group(detector=detector1, group=group1)
        self.create_detector_group(detector=detector1, group=group2)
        self.create_detector_group(detector=detector2, group=group3)

        result = get_open_issues_counts([detector1.id, detector2.id])
        assert result == {detector1.id: 2, detector2.id: 1}

    def test_cap_limits_count(self) -> None:
        detector = self.create_detector()
        for _ in range(5):
            group = self.create_group(project=self.project, status=GroupStatus.UNRESOLVED)
            self.create_detector_group(detector=detector, group=group)

        result = get_open_issues_counts([detector.id], cap=3)
        assert result == {detector.id: 3}
