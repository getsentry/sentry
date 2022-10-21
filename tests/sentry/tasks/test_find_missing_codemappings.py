from sentry.models.organization import OrganizationStatus
from sentry.tasks.find_missing_codemappings import find_missing_codemappings
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class TestCommitContext(TestCase):
    def setUp(self):
        self.organization = self.create_organization(status=OrganizationStatus.ACTIVE)
        self.project = self.create_project(organization=self.organization)

    def test_finds_stacktrace_paths_single_project(self):
        self.store_event(
            data={
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
            },
            project_id=self.project.id,
        )

        with self.tasks():
            mapping = find_missing_codemappings([self.organization])
        assert self.organization.slug in mapping
        project_to_stacktrace_paths = mapping[self.organization.slug]
        assert self.project.slug in result
        assert sorted(result[self.project.slug]) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]

    def test_finds_stacktrace_paths_multiple_projects(self):
        project_1 = self.create_project(organization=self.organization)
        project_2 = self.create_project(organization=self.organization)
        self.store_event(
            data={
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
            },
            project_id=project_1.id,
        )

        self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": iso_format(before_now(days=2)),
                "stacktrace": {
                    "frames": [
                        {
                            "function": "test_fn",
                            "abs_path": "/usr/src/sentry/src/sentry/test_file.py",
                            "module": "sentry.tasks",
                            "in_app": False,
                            "lineno": 30,
                            "filename": "sentry/test_file.py",
                        },
                        {
                            "function": "test_fn_2",
                            "abs_path": "/usr/src/sentry/src/sentry/models/test_file.py",
                            "module": "sentry.models.release",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/test_file.py",
                        },
                    ]
                },
                "fingerprint": ["put-me-in-the-control-group"],
            },
            project_id=project_2.id,
        )

        with self.tasks():
            mapping = find_missing_codemappings([self.organization])
        assert self.organization.slug in mapping
        result = mapping[self.organization.slug]
        assert project_1.slug in result
        assert sorted(result[project_1.slug]) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]
        assert project_2.slug in result
        assert sorted(result[project_2.slug]) == [
            "sentry/models/test_file.py",
            "sentry/test_file.py",
        ]

    def test_finds_stacktrace_paths_multiple_orgs(self):
        new_org = self.create_organization()
        new_project = self.create_project(organization=new_org)
        self.store_event(
            data={
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
            },
            project_id=self.project.id,
        )

        self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": iso_format(before_now(days=2)),
                "stacktrace": {
                    "frames": [
                        {
                            "function": "test_fn",
                            "abs_path": "/usr/src/sentry/src/sentry/test_file.py",
                            "module": "sentry.tasks",
                            "in_app": False,
                            "lineno": 30,
                            "filename": "sentry/test_file.py",
                        },
                        {
                            "function": "test_fn_2",
                            "abs_path": "/usr/src/sentry/src/sentry/models/test_file.py",
                            "module": "sentry.models.release",
                            "in_app": True,
                            "lineno": 39,
                            "filename": "sentry/models/test_file.py",
                        },
                    ]
                },
                "fingerprint": ["put-me-in-the-control-group"],
            },
            project_id=new_project.id,
        )

        with self.tasks():
            mapping = find_missing_codemappings([self.organization, new_org])
        assert self.organization.slug in mapping
        result_1 = mapping[self.organization.slug]
        assert self.project.slug in result_1
        assert sorted(result_1[self.project.slug]) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]
        assert new_org.slug in mapping
        result_2 = mapping[new_org.slug]
        assert new_project.slug in result_2
        assert sorted(result_2[new_project.slug]) == [
            "sentry/models/test_file.py",
            "sentry/test_file.py",
        ]

    def test_skips_stale_projects(self):
        self.store_event(
            data={
                "message": "Kaboom!",
                "platform": "python",
                "timestamp": iso_format(before_now(days=8)),
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
            },
            project_id=self.project.id,
        )

        with self.tasks():
            mapping = find_missing_codemappings()
        assert self.organization.slug in mapping
        result = mapping[self.organization.slug]
        assert self.project.slug not in result

    def test_handle_duplicate_frame_filenames_within_same_stacktrace(self):
        self.store_event(
            data={
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
                        {
                            "function": "handle_set_commits_new",
                            "abs_path": "/usr/src/sentry/src/sentry/tasks.py",
                            "module": "sentry.tasks",
                            "in_app": False,
                            "lineno": 40,
                            "filename": "sentry/tasks.py",
                        },
                    ]
                },
                "fingerprint": ["put-me-in-the-control-group"],
            },
            project_id=self.project.id,
        )

        with self.tasks():
            mapping = find_missing_codemappings([self.organization])
        assert self.organization.slug in mapping
        result = mapping[self.organization.slug]
        assert self.project.slug in result
        assert sorted(result[self.project.slug]) == [
            "sentry/models/release.py",
            "sentry/tasks.py",
        ]
