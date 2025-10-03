from __future__ import annotations

from sentry.models.release import Release
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
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

    def test_new_groups_multiple_releases_per_project(self):
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

        # Verify that when serialized together, counts are still isolated per release
        releases_by_version = {r["version"]: r for r in result_both}
        both_release_1 = releases_by_version["1.0.0"]
        both_release_2 = releases_by_version["2.0.0"]
        both_projects_1_by_id = {p["id"]: p for p in both_release_1["projects"]}
        both_projects_2_by_id = {p["id"]: p for p in both_release_2["projects"]}
        assert both_projects_1_by_id[project_a.id]["newGroups"] == 3
        assert both_projects_1_by_id[project_b.id]["newGroups"] == 2
        assert both_projects_2_by_id[project_a.id]["newGroups"] == 1
        assert both_projects_2_by_id[project_b.id]["newGroups"] == 4

    def test_new_groups_environment_filtering(self):
        """
        Test new group counts withenvironment filtering.
        """
        project_a = self.create_project(name="Project A", slug="project-a")
        project_b = self.create_project(
            name="Project B", slug="project-b", organization=project_a.organization
        )

        production = self.create_environment(name="production", organization=project_a.organization)
        staging = self.create_environment(name="staging", organization=project_a.organization)

        release = Release.objects.create(organization_id=project_a.organization_id, version="1.0.0")
        release.add_project(project_a)
        release.add_project(project_b)

        # 4 new groups for project A, 2 new groups for project B
        ReleaseProject.objects.filter(release=release, project=project_a).update(new_groups=4)
        ReleaseProject.objects.filter(release=release, project=project_b).update(new_groups=2)

        # Project A: 3 issues in production, 1 issue in staging (total = 4)
        ReleaseProjectEnvironment.objects.create(
            release=release, project=project_a, environment=production, new_issues_count=3
        )
        ReleaseProjectEnvironment.objects.create(
            release=release, project=project_a, environment=staging, new_issues_count=1
        )

        # Project B: 2 issues in production, 0 issues in staging (total = 2)
        ReleaseProjectEnvironment.objects.create(
            release=release, project=project_b, environment=production, new_issues_count=2
        )

        # 1. No environment filter
        result_no_env = release_serializer(
            releases=[release],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[],
            projects=[project_a, project_b],
        )
        assert len(result_no_env) == 1
        release_data_no_env = result_no_env[0]
        projects_no_env = {p["id"]: p for p in release_data_no_env["projects"]}
        assert projects_no_env[project_a.id]["newGroups"] == 4
        assert projects_no_env[project_b.id]["newGroups"] == 2
        assert release_data_no_env["newGroups"] == 6

        # 2. Filter by production environment
        result_production = release_serializer(
            releases=[release],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[production.id],
            projects=[project_a, project_b],
        )
        assert len(result_production) == 1
        release_data_production = result_production[0]
        projects_production = {p["id"]: p for p in release_data_production["projects"]}
        assert projects_production[project_a.id]["newGroups"] == 3
        assert projects_production[project_b.id]["newGroups"] == 2
        assert release_data_production["newGroups"] == 5

        # 3. Filter by staging environment
        result_staging = release_serializer(
            releases=[release],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[staging.id],  # Staging only
            projects=[project_a, project_b],
        )
        assert len(result_staging) == 1
        release_data_staging = result_staging[0]
        projects_staging = {p["id"]: p for p in release_data_staging["projects"]}
        assert projects_staging[project_a.id]["newGroups"] == 1
        assert project_b.id not in projects_staging
        assert release_data_staging["newGroups"] == 1

        # 4. Filter by both environments
        result_both_envs = release_serializer(
            releases=[release],
            user=self.user,
            organization_id=project_a.organization_id,
            environment_ids=[production.id, staging.id],
            projects=[project_a, project_b],
        )
        assert len(result_both_envs) == 1
        release_data_both_envs = result_both_envs[0]
        projects_both_envs = {p["id"]: p for p in release_data_both_envs["projects"]}
        assert projects_both_envs[project_a.id]["newGroups"] == 4
        assert projects_both_envs[project_b.id]["newGroups"] == 2
        assert release_data_both_envs["newGroups"] == 6

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
        """
        # TODO: Implement test
        pass
