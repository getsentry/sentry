from copy import deepcopy

from sentry.models.organization import OrganizationStatus
from sentry.tasks.derive_code_mappings import identify_stacktrace_paths
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class TestCommitContext(TestCase):
    def setUp(self):
        self.organization = self.create_organization(status=OrganizationStatus.ACTIVE)
        self.project = self.create_project(organization=self.organization)
        self.test_data_1 = {
            "message": "Kaboom!",
            "platform": "python",
            "timestamp": iso_format(before_now(days=1)),
            "stacktrace": {
                "frames": [
                    {
                        "function": "handle_set_commits",
                        "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                        "module": "sentry.tasks",
                        "in_app": False,
                        "lineno": 30,
                        "filename": "sentry/tasks.py",
                    },
                    {
                        "function": "set_commits",
                        "abs_path": "/usr/src/sentry/src/sentry/models/release.py",
                        "module": "sentry.models.release",
                        "in_app": True,
                        "lineno": 39,
                        "filename": "sentry/models/release.py",
                    },
                ]
            },
            "fingerprint": ["put-me-in-the-control-group"],
        }
        self.test_data_2 = deepcopy(self.test_data_1)
        self.test_data_2["stacktrace"]["frames"][0]["filename"] = "sentry/test_file.py"
        self.test_data_2["stacktrace"]["frames"][1]["filename"] = "sentry/models/test_file.py"
        self.test_data_2["fingerprint"] = ["new-group"]
        self.test_data_2["timestamp"] = iso_format(before_now(days=2))

    def test_finds_stacktrace_paths_single_project(self):
        self.store_event(data=self.test_data_1, project_id=self.project.id)

        with self.tasks():
            mapping = identify_stacktrace_paths([self.organization])
        assert self.organization.slug in mapping

        stacktrace_paths = mapping[self.organization.slug]
        assert self.project.slug in stacktrace_paths
        assert sorted(stacktrace_paths[self.project.slug]) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]

    def test_finds_stacktrace_paths_multiple_projects(self):
        project_2 = self.create_project(organization=self.organization)
        self.store_event(data=self.test_data_1, project_id=self.project.id)
        self.store_event(data=self.test_data_2, project_id=project_2.id)

        with self.tasks():
            mapping = identify_stacktrace_paths([self.organization])
        assert self.organization.slug in mapping
        stacktrace_paths = mapping[self.organization.slug]
        assert self.project.slug in stacktrace_paths
        assert sorted(stacktrace_paths[self.project.slug]) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]
        assert project_2.slug in stacktrace_paths
        assert sorted(stacktrace_paths[project_2.slug]) == [
            "sentry/models/test_file.py",
            "sentry/test_file.py",
        ]

    def test_finds_stacktrace_paths_multiple_orgs(self):
        new_org = self.create_organization()
        new_project = self.create_project(organization=new_org)
        self.store_event(self.test_data_1, project_id=self.project.id)
        self.store_event(data=self.test_data_2, project_id=new_project.id)

        with self.tasks():
            mapping = identify_stacktrace_paths([self.organization, new_org])
        assert self.organization.slug in mapping
        stacktrace_paths = mapping[self.organization.slug]
        assert self.project.slug in stacktrace_paths
        assert sorted(stacktrace_paths[self.project.slug]) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]
        assert new_org.slug in mapping
        stacktrace_paths = mapping[new_org.slug]
        assert new_project.slug in stacktrace_paths
        assert sorted(stacktrace_paths[new_project.slug]) == [
            "sentry/models/test_file.py",
            "sentry/test_file.py",
        ]

    def test_skips_stale_projects(self):
        stale_event = deepcopy(self.test_data_1)
        stale_event["timestamp"] = iso_format(before_now(days=8))
        self.store_event(data=stale_event, project_id=self.project.id)

        with self.tasks():
            mapping = identify_stacktrace_paths()
        assert self.organization.slug in mapping
        stacktrace_paths = mapping[self.organization.slug]
        assert self.project.slug not in stacktrace_paths

    def test_skips_outdated_events(self):
        stale_event = deepcopy(self.test_data_2)
        stale_event["timestamp"] = iso_format(before_now(days=16))
        self.store_event(data=self.test_data_1, project_id=self.project.id)
        self.store_event(data=stale_event, project_id=self.project.id)

        with self.tasks():
            mapping = identify_stacktrace_paths([self.organization])
        assert self.organization.slug in mapping
        stacktrace_paths = mapping[self.organization.slug]
        assert self.project.slug in stacktrace_paths
        assert sorted(stacktrace_paths[self.project.slug]) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]

    def test_handle_duplicate_filenames_in_a_project(self):
        self.store_event(data=self.test_data_1, project_id=self.project.id)
        duplicate_event = deepcopy(self.test_data_2)
        duplicate_event["stacktrace"]["frames"].append(self.test_data_1["stacktrace"]["frames"][0])
        self.store_event(data=duplicate_event, project_id=self.project.id)

        with self.tasks():
            mapping = identify_stacktrace_paths([self.organization])
        assert self.organization.slug in mapping
        stacktrace_paths = mapping[self.organization.slug]
        assert self.project.slug in stacktrace_paths
        assert sorted(stacktrace_paths[self.project.slug]) == [
            "sentry/models/release.py",
            "sentry/models/test_file.py",
            "sentry/tasks.py",
            "sentry/test_file.py",
        ]
