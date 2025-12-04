from sentry.constants import ObjectStatus
from sentry.grouping.grouptype import ErrorGroupType
from sentry.issues.grouptype import PerformanceNPlusOneAPICallsGroupType
from sentry.models.group import GroupStatus
from sentry.models.project import Project
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.workflow_engine.models import Detector, DetectorGroup
from sentry.workflow_engine.processors.backfill import (
    backfill_detector_groups,
    backfill_project_range,
    get_project_id_ranges_for_backfill,
)


class BackfillDetectorGroupsTest(TestCase):
    def test_backfills_unresolved_error_groups(self) -> None:

        detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)
        group1 = self.create_group(project=self.project, type=ErrorGroupType.type_id)
        group2 = self.create_group(project=self.project, type=ErrorGroupType.type_id)

        # No DetectorGroups should exist yet
        assert not DetectorGroup.objects.filter(detector=detector).exists()

        backfill_detector_groups(detector.id)

        # DetectorGroups should now exist for both groups
        assert DetectorGroup.objects.filter(detector=detector, group=group1).exists()
        assert DetectorGroup.objects.filter(detector=detector, group=group2).exists()
        assert DetectorGroup.objects.filter(detector=detector).count() == 2

    def test_skips_resolved_groups(self) -> None:

        detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)
        unresolved_group = self.create_group(
            project=self.project, type=ErrorGroupType.type_id, status=GroupStatus.UNRESOLVED
        )
        resolved_group = self.create_group(
            project=self.project, type=ErrorGroupType.type_id, status=GroupStatus.RESOLVED
        )

        backfill_detector_groups(detector.id)

        # Only unresolved group should have a DetectorGroup
        assert DetectorGroup.objects.filter(detector=detector, group=unresolved_group).exists()
        assert not DetectorGroup.objects.filter(detector=detector, group=resolved_group).exists()

    def test_skips_non_error_groups(self) -> None:
        detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)
        error_group = self.create_group(project=self.project, type=ErrorGroupType.type_id)
        perf_group = self.create_group(
            project=self.project, type=PerformanceNPlusOneAPICallsGroupType.type_id
        )

        backfill_detector_groups(detector.id)

        # Only error group should have a DetectorGroup
        assert DetectorGroup.objects.filter(detector=detector, group=error_group).exists()
        assert not DetectorGroup.objects.filter(detector=detector, group=perf_group).exists()

    def test_skips_existing_detector_groups(self) -> None:

        detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)
        group = self.create_group(project=self.project, type=ErrorGroupType.type_id)

        # Create existing DetectorGroup
        DetectorGroup.objects.create(detector=detector, group=group)

        backfill_detector_groups(detector.id)

        # Should still only have one DetectorGroup
        assert DetectorGroup.objects.filter(detector=detector, group=group).count() == 1

    def test_sets_date_added_to_group_first_seen(self) -> None:

        detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)
        first_seen = before_now(days=7)
        group = self.create_group(
            project=self.project, type=ErrorGroupType.type_id, first_seen=first_seen
        )

        backfill_detector_groups(detector.id)

        detector_group = DetectorGroup.objects.get(detector=detector, group=group)
        assert detector_group.date_added == first_seen

    def test_handles_missing_detector(self) -> None:

        # Should not raise an exception
        backfill_detector_groups(999999)

    def test_processes_multiple_groups(self) -> None:

        detector = self.create_detector(project=self.project, type=ErrorGroupType.slug)

        # Create multiple groups to ensure iteration works correctly
        num_groups = 50
        for _ in range(num_groups):
            self.create_group(project=self.project, type=ErrorGroupType.type_id)

        backfill_detector_groups(detector.id)

        # All groups should have DetectorGroups
        assert DetectorGroup.objects.filter(detector=detector).count() == num_groups


class BackfillProjectRangeTest(TestCase):
    def test_processes_projects_in_range(self) -> None:

        # Create multiple projects with detectors
        project1 = self.create_project()
        project2 = self.create_project()
        project3 = self.create_project()

        # Create detectors for each project
        detector1 = self.create_detector(project=project1, type=ErrorGroupType.slug)
        detector2 = self.create_detector(project=project2, type=ErrorGroupType.slug)
        detector3 = self.create_detector(project=project3, type=ErrorGroupType.slug)

        # Create unresolved error groups for each
        self.create_group(project=project1, type=ErrorGroupType.type_id)
        self.create_group(project=project2, type=ErrorGroupType.type_id)
        self.create_group(project=project3, type=ErrorGroupType.type_id)

        min_id = min(project1.id, project2.id, project3.id)
        max_id = max(project1.id, project2.id, project3.id)

        backfill_project_range(min_id, max_id)

        # Each project should have DetectorGroups
        assert DetectorGroup.objects.filter(detector=detector1).exists()
        assert DetectorGroup.objects.filter(detector=detector2).exists()
        assert DetectorGroup.objects.filter(detector=detector3).exists()

    def test_skips_projects_without_unresolved_groups(self) -> None:

        project_with_groups = self.create_project()
        project_without_groups = self.create_project()

        # Create detector for project with groups
        detector_with_groups = self.create_detector(
            project=project_with_groups, type=ErrorGroupType.slug
        )

        # Only create groups for one project
        self.create_group(project=project_with_groups, type=ErrorGroupType.type_id)

        min_id = min(project_with_groups.id, project_without_groups.id)
        max_id = max(project_with_groups.id, project_without_groups.id)

        backfill_project_range(min_id, max_id)

        # Only the project with groups should have DetectorGroups
        assert DetectorGroup.objects.filter(detector=detector_with_groups).exists()

    def test_skips_inactive_projects(self) -> None:

        active_project = self.create_project()
        inactive_project = self.create_project()
        inactive_project.status = ObjectStatus.PENDING_DELETION
        inactive_project.save()

        # Create detector for active project
        detector = self.create_detector(project=active_project, type=ErrorGroupType.slug)

        # Create groups for both
        self.create_group(project=active_project, type=ErrorGroupType.type_id)
        self.create_group(project=inactive_project, type=ErrorGroupType.type_id)

        min_id = min(active_project.id, inactive_project.id)
        max_id = max(active_project.id, inactive_project.id)

        backfill_project_range(min_id, max_id)

        # Only active project should be processed
        assert DetectorGroup.objects.filter(detector=detector).exists()

    def test_skips_project_without_detector(self) -> None:

        project = self.create_project()
        self.create_group(project=project, type=ErrorGroupType.type_id)

        # No detector should exist yet
        assert not Detector.objects.filter(project=project, type=ErrorGroupType.slug).exists()

        backfill_project_range(project.id, project.id)

        # Detector should still not exist (we don't create it)
        assert not Detector.objects.filter(project=project, type=ErrorGroupType.slug).exists()


class GetProjectIdRangesForBackfillTest(TestCase):
    def test_splits_projects_into_chunks(self) -> None:

        # Create 10 active projects
        for _ in range(10):
            self.create_project()

        num_chunks = 3
        ranges = list(get_project_id_ranges_for_backfill(num_chunks))

        # Should return 3 ranges
        assert len(ranges) == num_chunks

        # Each range should be a tuple of (min_id, max_id)
        for min_id, max_id in ranges:
            assert isinstance(min_id, int)
            assert isinstance(max_id, int)
            assert min_id <= max_id

    def test_covers_all_active_projects(self) -> None:

        # Create projects with varying statuses
        active_projects = [self.create_project() for _ in range(5)]
        inactive_project = self.create_project()
        inactive_project.status = ObjectStatus.PENDING_DELETION
        inactive_project.save()

        ranges = list(get_project_id_ranges_for_backfill(num_chunks=2))

        # Get all project IDs covered by ranges
        covered_ids = set[int]()
        for min_id, max_id in ranges:
            covered_ids.update(range(min_id, max_id + 1))

        # All active projects should be covered
        for project in active_projects:
            assert project.id in covered_ids

        # Inactive project should not be covered
        assert inactive_project.id not in covered_ids

    def test_single_chunk_returns_one_range(self) -> None:

        all_project_ids = [self.create_project().id for _ in range(5)]

        ranges = list(get_project_id_ranges_for_backfill(num_chunks=1))

        assert len(ranges) == 1
        min_id, max_id = ranges[0]

        # Should cover all project IDs
        assert min_id == min(all_project_ids)
        assert max_id == max(all_project_ids)

    def test_handles_no_projects(self) -> None:
        Project.objects.all().delete()

        ranges = list(get_project_id_ranges_for_backfill(num_chunks=5))

        assert len(ranges) == 0

    def test_more_chunks_than_projects(self) -> None:
        for _ in range(3):
            self.create_project()

        ranges = list(get_project_id_ranges_for_backfill(num_chunks=10))
        assert len(ranges) == 3
