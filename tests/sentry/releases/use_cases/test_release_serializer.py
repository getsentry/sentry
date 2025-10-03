from __future__ import annotations

from sentry.models.release import Release
from sentry.models.releases.release_project import ReleaseProject
from sentry.releases.use_cases.release import serialize as release_serializer
from sentry.testutils.cases import TestCase


class ReleaseSerializerUseCaseTest(TestCase):
    """
    Tests for the releases.use_cases.release.serialize function.

    This tests the NEW serializer that fixes the per-project newGroups calculation,
    as opposed to the old model-based serializer in api.serializers.models.release.
    """

    def test_new_groups_single_release_per_project(self):
        """
        Test new groups counts for one release with multiple projects, each having different issue counts.
        """
        project_a = self.create_project(name="Project A", slug="project-a")
        project_b = self.create_project(
            name="Project B", slug="project-b", organization=project_a.organization
        )

        # Create release in projects A and B
        release_version = "1.0.0"
        release = Release.objects.create(
            organization_id=project_a.organization_id, version=release_version
        )
        release.add_project(project_a)
        release.add_project(project_b)

        # 3 new groups for project A, 2 new groups for project B
        ReleaseProject.objects.filter(release=release, project=project_a).update(new_groups=3)
        ReleaseProject.objects.filter(release=release, project=project_b).update(new_groups=2)

        result = release_serializer(
            releases=[release],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[],  # No environment filtering
            projects=[project_a, project_b],
        )

        assert len(result) == 1
        serialized_release = result[0]

        # total new groups count (5 == 3 + 2)
        assert serialized_release["newGroups"] == 5

        # new groups count for each project (3 for A, 2 for B)
        projects_by_id = {p["id"]: p for p in serialized_release["projects"]}
        assert projects_by_id[project_a.id]["newGroups"] == 3
        assert projects_by_id[project_b.id]["newGroups"] == 2

        assert projects_by_id[project_a.id]["name"] == "Project A"
        assert projects_by_id[project_a.id]["slug"] == "project-a"
        assert projects_by_id[project_b.id]["name"] == "Project B"
        assert projects_by_id[project_b.id]["slug"] == "project-b"

    def test_multiple_releases_per_project_isolation(self):
        """
        Test new groups count for multiple releases per project.
        """
        project_a = self.create_project(name="Project A", slug="project-a")
        project_b = self.create_project(
            name="Project B", slug="project-b", organization=project_a.organization
        )

        # Create releases 1 and 2, both in projects A and B
        release_1 = Release.objects.create(
            organization_id=project_a.organization_id, version="1.0.0"
        )
        release_1.add_project(project_a)
        release_1.add_project(project_b)
        release_2 = Release.objects.create(
            organization_id=project_a.organization_id, version="2.0.0"
        )
        release_2.add_project(project_a)
        release_2.add_project(project_b)

        # Release 1.0.0 has 3 new groups for project A, 2 new groups for project B
        ReleaseProject.objects.filter(release=release_1, project=project_a).update(new_groups=3)
        ReleaseProject.objects.filter(release=release_1, project=project_b).update(new_groups=2)

        # Release 2.0.0 has 1 new groups for project A, 4 new groups for project B
        ReleaseProject.objects.filter(release=release_2, project=project_a).update(new_groups=1)
        ReleaseProject.objects.filter(release=release_2, project=project_b).update(new_groups=4)

        # 1. Serialize Release 1.0.0 ONLY
        result_1 = release_serializer(
            releases=[release_1],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[],
            projects=[project_a, project_b],
        )

        assert len(result_1) == 1
        release_1_data = result_1[0]
        assert release_1_data["version"] == "1.0.0"
        assert release_1_data["newGroups"] == 5  # total new groups count (5 == 3 + 2)
        projects_1_by_id = {p["id"]: p for p in release_1_data["projects"]}
        # new groups count for each project (3 for A, 2 for B)
        assert projects_1_by_id[project_a.id]["newGroups"] == 3
        assert projects_1_by_id[project_b.id]["newGroups"] == 2

        # 2. Serialize Release 2.0.0 ONLY
        result_2 = release_serializer(
            releases=[release_2],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[],
            projects=[project_a, project_b],
        )

        assert len(result_2) == 1
        release_2_data = result_2[0]
        assert release_2_data["version"] == "2.0.0"
        assert release_2_data["newGroups"] == 5  # total new groups count (5 == 1 + 4)
        projects_2_by_id = {p["id"]: p for p in release_2_data["projects"]}
        # new groups count for each project (1 for A, 4 for B)
        assert projects_2_by_id[project_a.id]["newGroups"] == 1
        assert projects_2_by_id[project_b.id]["newGroups"] == 4

        # 3. Serialize both releases together
        result_both = release_serializer(
            releases=[release_1, release_2],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[],
            projects=[project_a, project_b],
        )

        assert len(result_both) == 2

        # Find each release in the results
        releases_by_version = {r["version"]: r for r in result_both}
        both_release_1 = releases_by_version["1.0.0"]
        both_release_2 = releases_by_version["2.0.0"]

        # Verify that when serialized together, counts are still isolated per release
        both_projects_1_by_id = {p["id"]: p for p in both_release_1["projects"]}
        both_projects_2_by_id = {p["id"]: p for p in both_release_2["projects"]}
        # Release 1.0.0 should still have its isolated counts
        assert both_projects_1_by_id[project_a.id]["newGroups"] == 3
        assert both_projects_1_by_id[project_b.id]["newGroups"] == 2
        # Release 2.0.0 should still have its isolated counts
        assert both_projects_2_by_id[project_a.id]["newGroups"] == 1
        assert both_projects_2_by_id[project_b.id]["newGroups"] == 4

    def test_environment_filtering_per_project(self):
        """
        Test environment filtering with per-project counts.

        Scenario:
        - Release "1.0.0" in Project A: 3 issues in production, 1 issue in staging
        - Release "1.0.0" in Project B: 2 issues in production, 0 issues in staging
        - When filtering by production: Project A = 3, Project B = 2
        - When filtering by staging: Project A = 1, Project B = 0
        - When no environment filter: Project A = 3, Project B = 2 (uses ReleaseProject.new_groups)

        This verifies environment filtering works correctly with our fix.
        """
        # TODO: Implement test
        pass

    def test_cross_project_release_environment_complex(self):
        """
        Test complex scenario: Multiple releases, projects, and environments.

        Scenario:
        - Release "1.0.0":
          - Project A: 3 issues in production, 1 issue in staging
          - Project B: 2 issues in production, 0 issues in staging
        - Release "2.0.0":
          - Project A: 1 issue in production, 2 issues in staging
          - Project B: 4 issues in production, 1 issue in staging

        When serializing Release "1.0.0" with production filter:
        - Should return: Project A = 3, Project B = 2
        - Should NOT include counts from Release "2.0.0"

        This is the most comprehensive test of our fix.
        """
        # TODO: Implement test
        pass

    # def test_model_counts_vs_serializer_consistency(self):
    #     """
    #     Test that our serializer produces consistent results with model counts.

    #     Scenario:
    #     - Create releases and projects with known issue counts
    #     - Force buffer processing to update ReleaseProject.new_groups and ReleaseProjectEnvironment.new_issues_count
    #     - Compare serializer output with direct model queries
    #     - Verify they match after buffer processing

    #     This ensures our fix maintains consistency with the underlying model data.
    #     """
    #     # TODO: Implement test
    #     pass

    def test_backward_compatibility_release_level_totals(self):
        """
        Test that release-level totals (release.newGroups) remain unchanged.

        Scenario:
        - Create multiple projects with different issue counts
        - Verify that release.newGroups still equals sum of all project counts
        - Ensure existing frontend code that uses release.newGroups continues to work

        This ensures our fix doesn't break existing functionality.
        """
        # TODO: Implement test
        pass

    def test_empty_and_edge_cases(self):
        """
        Test edge cases: empty projects, zero counts, missing data.

        Scenarios:
        - Release with no projects
        - Release with projects but zero new issues
        - Release with missing ReleaseProject records
        - Release with None values in new_groups fields

        This ensures our fix handles edge cases gracefully.
        """
        # TODO: Implement test
        pass
