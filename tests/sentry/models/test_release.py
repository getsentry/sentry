from unittest.mock import patch

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from sentry.api.exceptions import InvalidRepository
from sentry.api.release_search import INVALID_SEMVER_MESSAGE
from sentry.exceptions import InvalidSearchQuery
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.environment import Environment
from sentry.models.group import Group, GroupStatus
from sentry.models.groupinbox import GroupInbox, GroupInboxReason, add_group_to_inbox
from sentry.models.grouplink import GroupLink
from sentry.models.grouprelease import GroupRelease
from sentry.models.groupresolution import GroupResolution
from sentry.models.release import Release, ReleaseStatus, follows_semver_versioning_scheme
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseenvironment import ReleaseEnvironment
from sentry.models.releaseheadcommit import ReleaseHeadCommit
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment
from sentry.models.releases.release_project import ReleaseProject
from sentry.models.repository import Repository
from sentry.search.events.filter import parse_semver
from sentry.signals import receivers_raise_on_send
from sentry.testutils.cases import SetRefsTestCase, TestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.datetime import freeze_time
from sentry.utils.strings import truncatechars


@pytest.mark.parametrize(
    "release_version",
    [
        "fake_package@1.0.0",
        "fake_package@1.0.0-alpha",
        "fake_package@1.0.0-alpha.1",
        "fake_package@1.0.0-alpha.beta",
        "fake_package@1.0.0-rc.1+43",
        "org.example.FooApp@1.0+whatever",
    ],
)
def test_version_is_semver_valid(release_version):
    assert Release.is_semver_version(release_version) is True


@pytest.mark.parametrize(
    "release_version",
    [
        "helloworld",
        "alpha@helloworld",
        "alpha@helloworld-1.0",
        "org.example.FooApp@9223372036854775808.1.2.3-r1+12345",
    ],
)
def test_version_is_semver_invalid(release_version):
    assert Release.is_semver_version(release_version) is False


class MergeReleasesTest(TestCase):
    @receivers_raise_on_send()
    def test_simple(self):
        org = self.create_organization()
        commit = Commit.objects.create(organization_id=org.id, repository_id=5)
        commit2 = Commit.objects.create(organization_id=org.id, repository_id=6)

        # merge to
        project = self.create_project(organization=org, name="foo")
        environment = Environment.get_or_create(project=project, name="env1")
        release = Release.objects.create(version="abcdabc", organization=org)
        release.add_project(project)
        release_commit = ReleaseCommit.objects.create(
            organization_id=org.id, release=release, commit=commit, order=1
        )
        release_environment = ReleaseEnvironment.objects.create(
            organization_id=org.id,
            project_id=project.id,
            release_id=release.id,
            environment_id=environment.id,
        )
        release_project_environment = ReleaseProjectEnvironment.objects.create(
            release_id=release.id, project_id=project.id, environment_id=environment.id
        )
        group_release = GroupRelease.objects.create(
            project_id=project.id, release_id=release.id, group_id=1
        )
        group = self.create_group(project=project, first_release=release)
        group_resolution = GroupResolution.objects.create(group=group, release=release)

        # merge from #1
        project2 = self.create_project(organization=org, name="bar")
        environment2 = Environment.get_or_create(project=project2, name="env2")
        release2 = Release.objects.create(version="bbbbbbb", organization=org)
        release2.add_project(project2)
        release_commit2 = ReleaseCommit.objects.create(
            organization_id=org.id, release=release2, commit=commit, order=2
        )
        release_environment2 = ReleaseEnvironment.objects.create(
            organization_id=org.id,
            project_id=project2.id,
            release_id=release2.id,
            environment_id=environment2.id,
        )
        release_project_environment2 = ReleaseProjectEnvironment.objects.create(
            release_id=release2.id, project_id=project2.id, environment_id=environment2.id
        )
        group_release2 = GroupRelease.objects.create(
            project_id=project2.id, release_id=release2.id, group_id=2
        )
        group2 = self.create_group(project=project2, first_release=release2)
        group_resolution2 = GroupResolution.objects.create(group=group2, release=release2)

        # merge from #2
        project3 = self.create_project(organization=org, name="baz")
        environment3 = Environment.get_or_create(project=project3, name="env3")
        release3 = Release.objects.create(version="cccccc", organization=org)
        release3.add_project(project3)
        release_commit3 = ReleaseCommit.objects.create(
            organization_id=org.id, release=release2, commit=commit2, order=3
        )
        release_environment3 = ReleaseEnvironment.objects.create(
            organization_id=org.id,
            project_id=project3.id,
            release_id=release3.id,
            environment_id=environment3.id,
        )
        release_project_environment3 = ReleaseProjectEnvironment.objects.create(
            release_id=release3.id, project_id=project3.id, environment_id=environment3.id
        )
        group_release3 = GroupRelease.objects.create(
            project_id=project3.id, release_id=release3.id, group_id=3
        )
        group3 = self.create_group(project=project3, first_release=release3)
        group_resolution3 = GroupResolution.objects.create(group=group3, release=release3)

        Release.merge(release, [release2, release3])

        # ReleaseCommit.release
        assert ReleaseCommit.objects.get(id=release_commit.id).release == release
        # should not exist because they referenced the same commit
        assert not ReleaseCommit.objects.filter(id=release_commit2.id).exists()
        assert ReleaseCommit.objects.get(id=release_commit3.id).release == release

        # ReleaseEnvironment.release_id
        assert ReleaseEnvironment.objects.get(id=release_environment.id).release_id == release.id
        assert ReleaseEnvironment.objects.get(id=release_environment2.id).release_id == release.id
        assert ReleaseEnvironment.objects.get(id=release_environment3.id).release_id == release.id

        # ReleaseProject.release
        assert release.projects.count() == 3
        assert ReleaseProject.objects.filter(release=release, project=project).exists()
        assert ReleaseProject.objects.filter(release=release, project=project2).exists()
        assert ReleaseProject.objects.filter(release=release, project=project3).exists()

        # ReleaseProjectEnvironment.release
        assert (
            ReleaseProjectEnvironment.objects.get(id=release_project_environment.id).release_id
            == release.id
        )
        assert (
            ReleaseProjectEnvironment.objects.get(id=release_project_environment2.id).release_id
            == release.id
        )
        assert (
            ReleaseProjectEnvironment.objects.get(id=release_project_environment3.id).release_id
            == release.id
        )

        # GroupRelease.release_id
        assert GroupRelease.objects.get(id=group_release.id).release_id == release.id
        assert GroupRelease.objects.get(id=group_release2.id).release_id == release.id
        assert GroupRelease.objects.get(id=group_release3.id).release_id == release.id

        # GroupResolution.release
        assert GroupResolution.objects.get(id=group_resolution.id).release == release
        assert GroupResolution.objects.get(id=group_resolution2.id).release == release
        assert GroupResolution.objects.get(id=group_resolution3.id).release == release

        # Group.first_release
        assert Group.objects.get(id=group.id).first_release == release
        assert Group.objects.get(id=group2.id).first_release == release
        assert Group.objects.get(id=group3.id).first_release == release

        # Releases are gone
        assert Release.objects.filter(id=release.id).exists()
        assert not Release.objects.filter(id=release2.id).exists()
        assert not Release.objects.filter(id=release3.id).exists()


class SetCommitsTestCase(TestCase):
    @receivers_raise_on_send()
    def test_simple(self):
        org = self.create_organization(owner=Factories.create_user())
        project = self.create_project(organization=org, name="foo")
        group = self.create_group(project=project)
        add_group_to_inbox(group, GroupInboxReason.MANUAL)
        assert GroupInbox.objects.filter(group=group).exists()

        repo = Repository.objects.create(organization_id=org.id, name="test/repo")
        commit = Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            message="fixes %s" % (group.qualified_short_id),
            key="alksdflskdfjsldkfajsflkslk",
        )
        commit2 = Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            message="i fixed something",
            key="lskfslknsdkcsnlkdflksfdkls",
        )

        assert GroupLink.objects.filter(
            group_id=group.id, linked_type=GroupLink.LinkedType.commit, linked_id=commit.id
        ).exists()

        release = Release.objects.create(version="abcdabc", organization=org)
        release.add_project(project)
        release.set_commits(
            [
                {"id": commit.key, "repository": repo.name},
                {"id": commit2.key, "repository": repo.name},
                {"id": "a" * 40, "repository": repo.name},
                {"id": "b" * 40, "repository": repo.name, "message": "#skipsentry"},
            ]
        )

        assert ReleaseCommit.objects.filter(commit=commit, release=release).exists()
        assert ReleaseCommit.objects.filter(commit=commit2, release=release).exists()

        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED
        # test that backfilling works
        assert Commit.objects.filter(key="a" * 40, repository_id=repo.id).exists()
        assert not Commit.objects.filter(key="b" * 40, repository_id=repo.id).exists()

        release = Release.objects.get(id=release.id)
        assert release.commit_count == 3
        assert release.authors == []
        assert release.last_commit_id == commit.id

        assert ReleaseHeadCommit.objects.filter(
            release_id=release.id, commit_id=commit.id, repository_id=repo.id
        ).exists()

        assert not GroupInbox.objects.filter(group=group).exists()

    @receivers_raise_on_send()
    def test_backfilling_commits(self):
        org = self.create_organization(owner=Factories.create_user())
        project = self.create_project(organization=org, name="foo")
        group = self.create_group(project=project)
        add_group_to_inbox(group, GroupInboxReason.MANUAL)
        assert GroupInbox.objects.filter(group=group).exists()
        repo = Repository.objects.create(organization_id=org.id, name="test/repo")

        commit = Commit.objects.create(repository_id=repo.id, organization_id=org.id, key="b" * 40)

        release = Release.objects.create(version="abcdabc", organization=org)
        release.add_project(project)
        release.set_commits(
            [
                {
                    "id": "a" * 40,
                    "repository": repo.name,
                    "author_email": "Foo@example.com",  # throw in an upper case letter
                    "author_name": "foo bar baz",
                    "message": "i fixed a bug",
                },
                {
                    "id": "b" * 40,
                    "repository": repo.name,
                    "author_email": "foo@example.com",
                    "author_name": "foo bar baz",
                    "message": "i fixed another bug",
                },
                {
                    "id": "c" * 40,
                    "repository": repo.name,
                    "author_email": "foo@example.com",
                    "author_name": "foo bar baz",
                    "message": "fixes %s" % (group.qualified_short_id),
                },
            ]
        )

        author = CommitAuthor.objects.get(
            name="foo bar baz", email="foo@example.com", organization_id=org.id
        )

        commit_a = Commit.objects.get(repository_id=repo.id, organization_id=org.id, key="a" * 40)
        assert commit_a
        assert commit_a.message == "i fixed a bug"
        assert commit_a.author_id == author.id

        commit_c = Commit.objects.get(repository_id=repo.id, organization_id=org.id, key="c" * 40)
        assert commit_c
        assert commit_c.message is not None
        assert "fixes" in commit_c.message
        assert commit_c.author_id == author.id

        # test that backfilling fills in missing message and author
        commit = Commit.objects.get(id=commit.id)
        assert commit.message == "i fixed another bug"
        assert commit.author_id == author.id

        assert ReleaseCommit.objects.filter(
            commit__key="a" * 40, commit__repository_id=repo.id, release=release
        ).exists()
        assert ReleaseCommit.objects.filter(
            commit__key="b" * 40, commit__repository_id=repo.id, release=release
        ).exists()
        assert ReleaseCommit.objects.filter(
            commit__key="c" * 40, commit__repository_id=repo.id, release=release
        ).exists()

        assert GroupLink.objects.filter(
            group_id=group.id, linked_type=GroupLink.LinkedType.commit, linked_id=commit_c.id
        ).exists()

        assert GroupResolution.objects.filter(group=group, release=release).exists()
        assert (
            GroupResolution.objects.get(group=group, release=release).status
            == GroupResolution.Status.resolved
        )
        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED

        latest_commit = Commit.objects.get(repository_id=repo.id, key="a" * 40)

        release = Release.objects.get(id=release.id)
        assert release.commit_count == 3
        assert release.authors == [str(author.id)]
        assert release.last_commit_id == latest_commit.id
        assert not GroupInbox.objects.filter(group=group).exists()

    @freeze_time()
    @receivers_raise_on_send()
    def test_using_saved_data(self):
        org = self.create_organization(owner=Factories.create_user())
        project = self.create_project(organization=org, name="foo")

        repo = Repository.objects.create(organization_id=org.id, name="test/repo")

        author = CommitAuthor.objects.create(
            name="foo bar baz", email="foo@example.com", organization_id=org.id
        )

        author.preload_users()
        Commit.objects.create(
            repository_id=repo.id,
            organization_id=org.id,
            key="b" * 40,
            author=author,
            date_added="2019-03-01 12:00:00+00:00",
            message="fixed a thing",
        )

        release = Release.objects.create(version="abcdabc", organization=org)
        release.add_project(project)
        release.set_commits(
            [
                {"id": "a" * 40, "repository": repo.name},
                {"id": "b" * 40, "repository": repo.name},
                {"id": "c" * 40, "repository": repo.name},
            ]
        )

        date_format = "%Y-%m-%d %H:%M:%S"
        assert Commit.objects.filter(
            repository_id=repo.id, organization_id=org.id, key="a" * 40
        ).exists()
        commit_c = Commit.objects.get(repository_id=repo.id, organization_id=org.id, key="c" * 40)
        assert commit_c.date_added.strftime(date_format) == timezone.now().strftime(date_format)
        assert commit_c.message is None

        # Using the id/repository payload should retain existing data.
        commit_b = Commit.objects.get(repository_id=repo.id, organization_id=org.id, key="b" * 40)
        assert commit_b.message == "fixed a thing"
        assert commit_b.date_added.strftime(date_format) == "2019-03-01 12:00:00"

        latest_commit = Commit.objects.get(repository_id=repo.id, key="a" * 40)

        release = Release.objects.get(id=release.id)
        assert release.commit_count == 3
        assert release.authors == [str(author.id)]
        assert release.last_commit_id == latest_commit.id

    @patch("sentry.models.Commit.update")
    @freeze_time()
    @receivers_raise_on_send()
    def test_multiple_releases_only_updates_once(self, mock_update):
        org = self.create_organization(owner=Factories.create_user())
        project = self.create_project(organization=org, name="foo")

        repo = Repository.objects.create(organization_id=org.id, name="test/repo")

        release = Release.objects.create(version="abcdabc", organization=org)
        release.add_project(project)

        release.set_commits([{"id": "b" * 40, "repository": repo.name, "message": "old message"}])

        # Setting the exact same commits, shouldn't call update
        release.set_commits([{"id": "b" * 40, "repository": repo.name, "message": "old message"}])
        assert mock_update.call_count == 0

        # Setting a different commit message, should call update
        release.set_commits([{"id": "b" * 40, "repository": repo.name, "message": "new message"}])
        assert mock_update.call_count == 1

    @receivers_raise_on_send()
    def test_resolution_support_full_featured(self):
        org = self.create_organization(owner=self.user)
        project = self.create_project(organization=org, name="foo")
        group = self.create_group(project=project)
        add_group_to_inbox(group, GroupInboxReason.MANUAL)
        assert GroupInbox.objects.filter(group=group).exists()
        repo = Repository.objects.create(organization_id=org.id, name="test/repo")
        author = CommitAuthor.objects.create(
            organization_id=org.id, name="Foo Bar", email=self.user.email
        )
        author.preload_users()
        commit = Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            message="fixes %s" % (group.qualified_short_id),
            key="alksdflskdfjsldkfajsflkslk",
            author=author,
        )

        old_release = self.create_release(project=project, version="pre-1.0")

        resolution = GroupResolution.objects.create(
            group=group,
            release=old_release,
            type=GroupResolution.Type.in_next_release,
            status=GroupResolution.Status.pending,
        )

        release = self.create_release(project=project, version="abcdabc")
        release.set_commits([{"id": commit.key, "repository": repo.name}])

        assert GroupLink.objects.filter(
            group_id=group.id, linked_type=GroupLink.LinkedType.commit, linked_id=commit.id
        ).exists()

        # Pull the object from the DB again to test updated attributes
        resolution = GroupResolution.objects.get(group=group)
        assert resolution.status == GroupResolution.Status.resolved
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.actor_id == self.user.id

        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED
        assert not GroupInbox.objects.filter(group=group).exists()

    @receivers_raise_on_send()
    def test_resolution_support_without_author(self):
        org = self.create_organization(owner=Factories.create_user())
        project = self.create_project(organization=org, name="foo")
        group = self.create_group(project=project)
        add_group_to_inbox(group, GroupInboxReason.MANUAL)
        assert GroupInbox.objects.filter(group=group).exists()
        repo = Repository.objects.create(organization_id=org.id, name="test/repo")
        commit = Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            message="fixes %s" % (group.qualified_short_id),
            key="alksdflskdfjsldkfajsflkslk",
        )

        release = self.create_release(project=project, version="abcdabc")
        release.set_commits([{"id": commit.key, "repository": repo.name}])

        assert GroupLink.objects.filter(
            group_id=group.id, linked_type=GroupLink.LinkedType.commit, linked_id=commit.id
        ).exists()

        resolution = GroupResolution.objects.get(group=group)
        assert resolution.status == GroupResolution.Status.resolved
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.actor_id is None

        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED
        assert not GroupInbox.objects.filter(group=group).exists()

    @patch("sentry.integrations.example.integration.ExampleIntegration.sync_status_outbound")
    @receivers_raise_on_send()
    def test_resolution_support_with_integration(self, mock_sync_status_outbound):
        org = self.create_organization(owner=Factories.create_user())
        integration = self.create_integration(
            organization=org,
            external_id="example:1",
            provider="example",
            name="Example",
            oi_params={
                "config": {
                    "sync_comments": True,
                    "sync_status_outbound": True,
                    "sync_status_inbound": True,
                    "sync_assignee_outbound": True,
                    "sync_assignee_inbound": True,
                }
            },
        )
        project = self.create_project(organization=org, name="foo")
        group = self.create_group(project=project)
        add_group_to_inbox(group, GroupInboxReason.MANUAL)
        assert GroupInbox.objects.filter(group=group).exists()
        external_issue = ExternalIssue.objects.get_or_create(
            organization_id=org.id, integration_id=integration.id, key="APP-%s" % group.id
        )[0]

        GroupLink.objects.get_or_create(
            group_id=group.id,
            project_id=group.project_id,
            linked_type=GroupLink.LinkedType.issue,
            linked_id=external_issue.id,
            relationship=GroupLink.Relationship.references,
        )[0]

        repo = Repository.objects.create(organization_id=org.id, name="test/repo")
        commit = Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            message="fixes %s" % (group.qualified_short_id),
            key="alksdflskdfjsldkfajsflkslk",
        )

        release = self.create_release(project=project, version="abcdabc")

        with self.tasks():
            with self.feature({"organizations:integrations-issue-sync": True}):
                release.set_commits([{"id": commit.key, "repository": repo.name}])

        mock_sync_status_outbound.assert_called_once_with(external_issue, True, group.project_id)

        assert GroupLink.objects.filter(
            group_id=group.id, linked_type=GroupLink.LinkedType.commit, linked_id=commit.id
        ).exists()

        resolution = GroupResolution.objects.get(group=group)
        assert resolution.status == GroupResolution.Status.resolved
        assert resolution.release == release
        assert resolution.type == GroupResolution.Type.in_release
        assert resolution.actor_id is None

        assert Group.objects.get(id=group.id).status == GroupStatus.RESOLVED
        assert not GroupInbox.objects.filter(group=group).exists()

    @receivers_raise_on_send()
    def test_long_email(self):
        org = self.create_organization(owner=Factories.create_user())
        project = self.create_project(organization=org, name="foo")

        repo = Repository.objects.create(organization_id=org.id, name="test/repo")

        release = Release.objects.create(version="abcdabc", organization=org)
        release.add_project(project)
        commit_email = "a" * 248 + "@a.com"  # 254 chars long, max valid email.
        release.set_commits(
            [
                {
                    "id": "a" * 40,
                    "repository": repo.name,
                    "author_name": "foo bar baz",
                    "author_email": commit_email,
                    "message": "i fixed a bug",
                }
            ]
        )
        commit = Commit.objects.get(repository_id=repo.id, organization_id=org.id, key="a" * 40)
        assert commit.author is not None
        assert commit.author.email == truncatechars(commit_email, 75)


class SetRefsTest(SetRefsTestCase):
    def setUp(self):
        super().setUp()
        self.release = Release.objects.create(version="abcdabc", organization=self.org)
        self.release.add_project(self.project)

    @patch("sentry.tasks.commits.fetch_commits")
    @receivers_raise_on_send()
    def test_simple(self, mock_fetch_commit):
        refs = [
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-id",
                "commit": "current-commit-id",
            },
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-id-2",
                "commit": "current-commit-id-2",
            },
        ]

        self.release.set_refs(refs, self.user.id, True)

        commits = Commit.objects.all().order_by("id")
        self.assert_commit(commits[0], refs[0]["commit"])
        self.assert_commit(commits[1], refs[1]["commit"])

        head_commits = ReleaseHeadCommit.objects.all()
        self.assert_head_commit(head_commits[0], refs[1]["commit"])

        self.assert_fetch_commits(mock_fetch_commit, None, self.release.id, refs)

    @patch("sentry.tasks.commits.fetch_commits")
    @receivers_raise_on_send()
    def test_invalid_repos(self, mock_fetch_commit):
        refs = [
            {
                "repository": "unknown-repository-name",
                "previousCommit": "previous-commit-id",
                "commit": "current-commit-id",
            },
            {
                "repository": "unknown-repository-name",
                "previousCommit": "previous-commit-id-2",
                "commit": "current-commit-id-2",
            },
        ]

        with pytest.raises(InvalidRepository):
            self.release.set_refs(refs, self.user.id)

        assert len(Commit.objects.all()) == 0
        assert len(ReleaseHeadCommit.objects.all()) == 0

    @patch("sentry.tasks.commits.fetch_commits")
    @receivers_raise_on_send()
    def test_handle_commit_ranges(self, mock_fetch_commit):
        refs = [
            {
                "repository": "test/repo",
                "previousCommit": None,
                "commit": "previous-commit-id..current-commit-id",
            },
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-will-be-ignored",
                "commit": "previous-commit-id-2..current-commit-id-2",
            },
            {"repository": "test/repo", "commit": "previous-commit-id-3..current-commit-id-3"},
        ]

        self.release.set_refs(refs, self.user.id, True)

        commits = Commit.objects.all().order_by("id")
        self.assert_commit(commits[0], "current-commit-id")
        self.assert_commit(commits[1], "current-commit-id-2")
        self.assert_commit(commits[2], "current-commit-id-3")

        head_commits = ReleaseHeadCommit.objects.all()
        self.assert_head_commit(head_commits[0], "current-commit-id-3")

        self.assert_fetch_commits(mock_fetch_commit, None, self.release.id, refs)

    @patch("sentry.tasks.commits.fetch_commits")
    @receivers_raise_on_send()
    def test_fetch_false(self, mock_fetch_commit):
        refs = [
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-id",
                "commit": "current-commit-id",
            },
            {
                "repository": "test/repo",
                "previousCommit": "previous-commit-id-2",
                "commit": "current-commit-id-2",
            },
        ]

        self.release.set_refs(refs, self.user.id, False)

        commits = Commit.objects.all().order_by("id")
        self.assert_commit(commits[0], refs[0]["commit"])
        self.assert_commit(commits[1], refs[1]["commit"])

        head_commits = ReleaseHeadCommit.objects.all()
        self.assert_head_commit(head_commits[0], refs[1]["commit"])

        assert len(mock_fetch_commit.method_calls) == 0

    def test_invalid_version_none_value(self):
        assert not Release.is_valid_version(None)

    def test_invalid_version(self):
        cases = ["", "latest", ".", "..", "\t", "\n", "  "]

        for case in cases:
            with pytest.raises(ValidationError):
                Release.objects.create(version=case, organization=self.org)

        with pytest.raises(ValidationError):
            Release.objects.create(organization=self.org)

    # @staticmethod
    def test_invalid_chars_in_version(self):
        version = (
            "\n> rfrontend@0.1.0 release:version\n> echo "
            "'dev-19be1b7e-dirty'\n\ndev-19be1b7e-dirty"
        )
        assert not Release.is_valid_version(version)

        version = "\t hello world"
        assert not Release.is_valid_version(version)

        version = "\f hello world again"
        assert not Release.is_valid_version(version)

        version = "/ helo"
        assert not Release.is_valid_version(version)

        version = "\r hello world again"
        assert not Release.is_valid_version(version)

        version = "\x0c dogs and rabbits"
        assert not Release.is_valid_version(version)

        version = "\\ hello world again"
        assert not Release.is_valid_version(version)


class SemverReleaseParseTestCase(TestCase):
    def setUp(self):
        self.org = self.create_organization()

    def test_parse_release_into_semver_cols(self):
        """
        Test that ensures that release version is parsed into the semver cols on Release model
        and that if build code can be parsed as a 64 bit integer then it is stored in build_number
        """
        version = "org.example.FooApp@1.0rc1+20200101100"
        release = Release.objects.create(organization=self.org, version=version)
        assert release.major == 1
        assert release.minor == 0
        assert release.patch == 0
        assert release.revision == 0
        assert release.prerelease == "rc1"
        assert release.build_code == "20200101100"
        assert release.build_number == 20200101100
        assert release.package == "org.example.FooApp"

    def test_parse_release_into_semver_cols_using_custom_get_or_create(self):
        """
        Test that ensures that release version is parsed into the semver cols on Release model
        when using the custom `Release.get_or_create` method
        """
        version = "org.example.FooApp@1.0rc1+20200101100"
        project = self.create_project(organization=self.org, name="foo")
        release = Release.get_or_create(project=project, version=version)
        assert release.major == 1
        assert release.minor == 0
        assert release.patch == 0
        assert release.revision == 0
        assert release.prerelease == "rc1"
        assert release.build_code == "20200101100"
        assert release.build_number == 20200101100
        assert release.package == "org.example.FooApp"

    def test_parse_release_into_semver_cols_with_non_int_build_code(self):
        """
        Test that ensures that if the build_code passed as part of the semver version cannot be
        parsed as a 64 bit integer due to non int release then build number is left empty
        """
        version = "org.example.FooApp@1.0rc1+whatever"
        release = Release.objects.create(organization=self.org, version=version)
        assert release.major == 1
        assert release.minor == 0
        assert release.patch == 0
        assert release.revision == 0
        assert release.prerelease == "rc1"
        assert release.build_code == "whatever"
        assert release.build_number is None
        assert release.package == "org.example.FooApp"

    def test_parse_release_into_semver_cols_with_int_build_code_gt_64_int(self):
        """
        Test that ensures that if the build_code passed as part of the semver version cannot be
        parsed as a 64 bit integer due to bigger than 64 bit integer then build number is left empty
        """
        version = "org.example.FooApp@1.0rc1+202001011005464576758979789794566455464746"
        release = Release.objects.create(organization=self.org, version=version)
        assert release.major == 1
        assert release.minor == 0
        assert release.patch == 0
        assert release.revision == 0
        assert release.prerelease == "rc1"
        assert release.build_code == "202001011005464576758979789794566455464746"
        assert release.build_number is None
        assert release.package == "org.example.FooApp"

    def test_parse_release_into_semver_cols_with_negative_build_code(self):
        """
        Test that ensures that if the build_code passed as part of the semver version can be
        parsed as a 64 bit integer but has a negative sign then build number is left
        empty
        """
        version = "org.example.FooApp@1.0rc1+-2020"
        release = Release.objects.create(organization=self.org, version=version)
        assert release.major == 1
        assert release.minor == 0
        assert release.patch == 0
        assert release.revision == 0
        assert release.prerelease == "rc1"
        assert release.build_code == "-2020"
        assert release.build_number is None
        assert release.package == "org.example.FooApp"

    def test_parse_release_into_semver_cols_with_no_prerelease(self):
        """
        Test that ensures that prerelease is stores as an empty string if not included
        in the version.
        """
        version = "org.example.FooApp@1.0+whatever"
        release = Release.objects.create(organization=self.org, version=version)
        assert release.major == 1
        assert release.minor == 0
        assert release.patch == 0
        assert release.revision == 0
        assert release.prerelease == ""
        assert release.build_code == "whatever"
        assert release.build_number is None
        assert release.package == "org.example.FooApp"

    def test_parse_non_semver_should_not_fail(self):
        """
        Test that ensures nothing breaks when sending a non semver compatible release
        """
        version = "hello world"
        release = Release.objects.create(organization=self.org, version=version)
        assert release.version == "hello world"

    def test_parse_release_overflow_bigint(self):
        """
        Tests that we don't error if we have a version component that is larger than
        a postgres bigint.
        """
        version = "org.example.FooApp@9223372036854775808.1.2.3-r1+12345"
        release = Release.objects.create(organization=self.org, version=version)
        assert release.version == version
        assert release.major is None
        assert release.minor is None
        assert release.patch is None
        assert release.revision is None
        assert release.prerelease is None
        assert release.build_code is None
        assert release.build_number is None
        assert release.package is None

    def test_parse_release_into_semver_cols_with_get_or_create(self):
        """
        Test that ensures get_or_create populates semver fields
        """
        version = "org.example.FooApp@1.0rc1+-2020"
        release, _ = Release.objects.get_or_create(
            organization=self.org, version=version, defaults={"status": ReleaseStatus.OPEN}
        )
        assert release.major == 1
        assert release.minor == 0
        assert release.patch == 0
        assert release.revision == 0
        assert release.prerelease == "rc1"
        assert release.build_code == "-2020"
        assert release.build_number is None
        assert release.package == "org.example.FooApp"

    def test_parse_release_into_semver_cols_on_pre_save(self):
        """
        Test that ensures that calling save on a new Release instance parses version into semver
        columns
        """
        version = "org.example.FooApp@1.0rc1+-2020"
        release = Release(organization=self.org, version=version)
        release.save()
        assert release.major == 1
        assert release.minor == 0
        assert release.patch == 0
        assert release.revision == 0
        assert release.prerelease == "rc1"
        assert release.build_code == "-2020"
        assert release.build_number is None
        assert release.package == "org.example.FooApp"

    def test_does_not_parse_release_into_semver_cols_on_pre_save_for_existing_release(self):
        """
        Test that ensures that calling save on an existing Release instance does not re-parse
        version into semver columns
        """
        version = "org.example.FooApp@1.0rc1+-2020"
        release = Release(organization=self.org, version=version)
        release.save()
        assert release.major == 1
        assert release.minor == 0
        assert release.patch == 0
        assert release.revision == 0
        assert release.prerelease == "rc1"
        assert release.build_code == "-2020"
        assert release.build_number is None
        assert release.package == "org.example.FooApp"
        release.version = "org.example.FooApp@1.0rc1+-1999"
        release.save()
        assert release.build_code == "-2020"


class ReleaseFilterBySemverTest(TestCase):
    def test_invalid_query(self):
        with pytest.raises(
            InvalidSearchQuery,
            match=INVALID_SEMVER_MESSAGE,
        ):
            Release.objects.filter_by_semver(self.organization.id, parse_semver("1.2.hi", ">"))

    def run_test(self, operator, version, expected_releases, organization_id=None, projects=None):
        organization_id = organization_id if organization_id else self.organization.id
        project_ids = [p.id for p in projects] if projects else None
        assert set(
            Release.objects.filter_by_semver(
                organization_id, parse_semver(version, operator), project_ids=project_ids
            )
        ) == set(expected_releases)

    def test(self):
        release = self.create_release(version="test@1.2.3")
        release_2 = self.create_release(version="test@1.2.4")
        self.run_test(">", "1.2.3", [release_2])
        self.run_test(">=", "1.2.4", [release_2])
        self.run_test("<", "1.2.4", [release])
        self.run_test("<=", "1.2.3", [release])
        self.run_test("!=", "1.2.3", [release_2])

    def test_prerelease(self):
        # Prerelease has weird sorting rules, where an empty string is higher priority
        # than a non-empty string. Make sure this sorting works
        release = self.create_release(version="test@1.2.3-alpha")
        release_1 = self.create_release(version="test@1.2.3-beta")
        release_2 = self.create_release(version="test@1.2.3")
        release_3 = self.create_release(version="test@1.2.4-alpha")
        release_4 = self.create_release(version="test@1.2.4")
        self.run_test(">=", "1.2.3", [release_2, release_3, release_4])
        self.run_test(
            ">=",
            "1.2.3-beta",
            [release_1, release_2, release_3, release_4],
        )
        self.run_test("<", "1.2.3", [release_1, release])

    def test_granularity(self):
        self.create_release(version="test@1.0.0.0")
        release_2 = self.create_release(version="test@1.2.0.0")
        release_3 = self.create_release(version="test@1.2.3.0")
        release_4 = self.create_release(version="test@1.2.3.4")
        release_5 = self.create_release(version="test@2.0.0.0")
        self.run_test(
            ">",
            "1",
            [release_2, release_3, release_4, release_5],
        )
        self.run_test(">", "1.2", [release_3, release_4, release_5])
        self.run_test(">", "1.2.3", [release_4, release_5])
        self.run_test(">", "1.2.3.4", [release_5])
        self.run_test(">", "2", [])

    def test_wildcard(self):
        release_1 = self.create_release(version="test@1.0.0.0")
        release_2 = self.create_release(version="test@1.2.0.0")
        release_3 = self.create_release(version="test@1.2.3.0")
        release_4 = self.create_release(version="test@1.2.3.4")
        release_5 = self.create_release(version="test@2.0.0.0")

        self.run_test(
            "=",
            "1.X",
            [release_1, release_2, release_3, release_4],
        )
        self.run_test("=", "1.2.*", [release_2, release_3, release_4])
        self.run_test("=", "1.2.3.*", [release_3, release_4])
        self.run_test("=", "1.2.3.4", [release_4])
        self.run_test("=", "2.*", [release_5])

    def test_package(self):
        release = self.create_release(version="test@1.2.3")
        release_2 = self.create_release(version="test2@1.2.3")
        self.run_test(">=", "test@1.2.3", [release])
        self.run_test(">=", "test2@1.2.3", [release_2])

    def test_project(self):
        project_2 = self.create_project()
        release = self.create_release(version="test@1.2.3")
        release_2 = self.create_release(version="test@1.2.4")
        release_3 = self.create_release(version="test@1.2.5", additional_projects=[project_2])
        release_4 = self.create_release(version="test@1.2.6", project=project_2)
        self.run_test(">=", "test@1.2.3", [release, release_2, release_3, release_4])
        self.run_test(
            ">=",
            "test@1.2.3",
            [release, release_2, release_3, release_4],
            projects=[self.project, project_2],
        )
        self.run_test(">=", "test@1.2.3", [release, release_2, release_3], projects=[self.project])
        self.run_test(">=", "test@1.2.3", [release_3, release_4], projects=[project_2])


class ReleaseFilterBySemverBuildTest(TestCase):
    def run_test(self, operator, build, expected_releases, organization_id=None, projects=None):
        organization_id = organization_id if organization_id else self.organization.id
        project_ids = [p.id for p in projects] if projects else None
        assert set(
            Release.objects.filter_by_semver_build(
                organization_id, operator, build, project_ids=project_ids
            )
        ) == set(expected_releases)

    def test_no_build(self):
        self.create_release(version="test@1.2.3")
        self.create_release(version="test@1.2.4")
        self.run_test("gt", "100", [])
        self.run_test("exact", "105aab", [])

    def test_numeric(self):
        release_1 = self.create_release(version="test@1.2.3+123")
        release_2 = self.create_release(version="test@1.2.4+456")
        self.create_release(version="test@1.2.4+123abc")
        self.run_test("gt", "123", [release_2])
        self.run_test("lte", "123", [release_1])
        self.run_test("exact", "123", [release_1])

    def test_large_numeric(self):
        release_1 = self.create_release(version="test@1.2.3+9223372036854775808")
        self.create_release(version="test@1.2.3+9223372036854775809")

        # This should only return `release_1`, since this exceeds the max size for a bigint and
        # so should fall back to an exact string match instead.
        self.run_test("gt", "9223372036854775808", [release_1])

    def test_text(self):
        release_1 = self.create_release(version="test@1.2.3+123")
        release_2 = self.create_release(version="test@1.2.4+1234")
        release_3 = self.create_release(version="test@1.2.4+123abc")

        self.run_test("exact", "", [release_1, release_2, release_3])
        self.run_test("exact", "*", [release_1, release_2, release_3])
        self.run_test("exact", "123*", [release_1, release_2, release_3])
        self.run_test("exact", "123a*", [release_3])
        self.run_test("exact", "123ab", [])
        self.run_test("exact", "123abc", [release_3])


class FollowsSemverVersioningSchemeTestCase(TestCase):
    def setUp(self):
        self.org = self.create_organization()
        self.fake_package = "_fake_package_prj_"

        # Project with 10 semver releases
        self.proj_1 = self.create_project(organization=self.org)
        for i in range(10):
            self.create_release(version=f"fake_package-ahmed@1.1.{i}", project=self.proj_1)

    def test_follows_semver_with_all_releases_semver_and_semver_release_version(self):
        """
        Test that ensures that when the last 10 releases and the release version passed in as an arg
        follow semver versioning, then True should be returned
        """
        assert (
            follows_semver_versioning_scheme(
                org_id=self.org.id, project_id=self.proj_1.id, release_version="fake_package@2.0.0"
            )
            is True
        )

    def test_follows_semver_all_releases_semver_and_missing_package_semver_release_version(self):
        """
        Test that ensures that even if a project is following semver, then if the release_version
        supplied lacks a package, then for that specific release we opt the project out of being
        considered a semver project
        """
        assert (
            follows_semver_versioning_scheme(
                org_id=self.org.id, project_id=self.proj_1.id, release_version="2.0.0"
            )
            is False
        )

    def test_follows_semver_with_all_releases_semver_and_no_release_version(self):
        """
        Test that ensures that when the last 10 releases follow semver versioning and no release
        version is passed in as an argument, then True should be returned
        """
        assert (
            follows_semver_versioning_scheme(org_id=self.org.id, project_id=self.proj_1.id) is True
        )

    def test_follows_semver_with_all_releases_semver_and_non_semver_release_version(self):
        """
        Test that ensures that even if the last 10 releases follow semver but the passed in
        release_version doesn't then we should return False because we should not follow semver
        versioning in this case
        """
        assert (
            follows_semver_versioning_scheme(
                org_id=self.org.id, project_id=self.proj_1.id, release_version="fizbuzz"
            )
            is False
        )

    def test_follows_semver_user_accidentally_stopped_using_semver_a_few_times(self):
        """
        Test that ensures that when a user accidentally stops using semver versioning for a few
        times but there exists at least one semver compliant release in the last 3 releases and
        at least 3 releases that are semver compliant in the last 10 then we still consider
        project to be following semantic versioning
        """
        proj = self.create_project(organization=self.org)

        for i in range(2):
            self.create_release(version=f"{self.fake_package}{proj.id}@1.{i}", project=proj)
        for i in range(7):
            self.create_release(version=f"foo release {i}", project=proj)
        self.create_release(version=f"{self.fake_package}{proj.id}@1.9", project=proj)

        assert (
            follows_semver_versioning_scheme(
                org_id=self.org.id,
                project_id=proj.id,
            )
            is True
        )

    def test_follows_semver_user_stops_using_semver(self):
        """
        Test that ensures that if a user stops using semver and so the last 3 releases in the last
        10 releases are all non-semver releases, then the project does not follow semver anymore
        since 1st condition of at least one semver release in the last 3 has to be a semver
        release is not satisfied
        """
        proj = self.create_project(organization=self.org)

        for i in range(7):
            self.create_release(version=f"{self.fake_package}{proj.id}@1.{i}", project=proj)
        for i in range(3):
            self.create_release(version=f"helloworld {i}", project=proj)

        assert (
            follows_semver_versioning_scheme(
                org_id=self.org.id,
                project_id=proj.id,
            )
            is False
        )

    def test_follows_semver_user_accidentally_uses_semver_a_few_times(self):
        """
        Test that ensures that if user accidentally uses semver compliant versions for a few
        times then the project will not be considered to be using semver
        """
        proj = self.create_project(organization=self.org)

        for i in range(8):
            self.create_release(version=f"foo release {i}", project=proj)
        for i in range(2):
            self.create_release(version=f"{self.fake_package}{proj.id}@1.{i}", project=proj)

        assert (
            follows_semver_versioning_scheme(
                org_id=self.org.id,
                project_id=proj.id,
            )
            is False
        )

    def test_follows_semver_user_starts_using_semver(self):
        """
        Test that ensures if a user starts using semver by having at least the last 3 releases
        using semver then we consider the project to be using semver
        """
        proj = self.create_project(organization=self.org)

        for i in range(7):
            self.create_release(version=f"foo release {i}", project=proj)
        for i in range(3):
            self.create_release(version=f"{self.fake_package}{proj.id}@1.{i}", project=proj)

        assert (
            follows_semver_versioning_scheme(
                org_id=self.org.id,
                project_id=proj.id,
            )
            is True
        )

    def test_follows_semver_user_starts_using_semver_with_less_than_10_recent_releases(self):
        """
        Test that ensures that a project with only 5 (<10) releases and at least one semver
        release in the most recent releases is considered to be following semver
        """
        proj = self.create_project(organization=self.org)

        for i in range(4):
            self.create_release(version=f"helloworld {i}", project=proj)
        self.create_release(version=f"{self.fake_package}{proj.id}@1.0", project=proj)

        assert (
            follows_semver_versioning_scheme(
                org_id=self.org.id,
                project_id=proj.id,
            )
            is True
        )

    def test_follows_semver_check_when_project_only_has_two_releases(self):
        """
        Test that ensures that when a project has only two releases, then we consider project to
        be semver or not based on if the most recent release follows semver or not
        """
        # Case: User just started using semver
        proj = self.create_project(organization=self.org)
        self.create_release(version="helloworld 0", project=proj)
        self.create_release(version=f"{self.fake_package}{proj.id}@1.0", project=proj)
        assert (
            follows_semver_versioning_scheme(
                org_id=self.org.id,
                project_id=proj.id,
            )
            is True
        )

        # Case: User just stopped using semver
        proj_2 = self.create_project(organization=self.org)
        self.create_release(version=f"{self.fake_package}{proj_2.id}@1.0", project=proj_2)
        self.create_release(version="helloworld 1", project=proj_2)
        assert (
            follows_semver_versioning_scheme(
                org_id=self.org.id,
                project_id=proj_2.id,
            )
            is False
        )

    def test_follows_semver_check_with_archived_non_semver_releases(self):
        """
        Test that ensures that when a project has a mix of archived non-semver releases and active semver releases,
        then we consider the project to be following semver.
        """
        proj = self.create_project(organization=self.org)

        # Create semver releases that are not archived
        for i in range(4):
            self.create_release(version=f"{self.fake_package}@1.0.{i}", project=proj)

        # Create non-semver releases and archive them
        for i in range(6):
            release = self.create_release(version=f"notsemver-{i}", project=proj)
            release.update(status=ReleaseStatus.ARCHIVED)

        assert (
            follows_semver_versioning_scheme(
                org_id=self.org.id,
                project_id=proj.id,
            )
            is True
        )


class ClearCommitsTestCase(TestCase):
    @receivers_raise_on_send()
    def test_simple(self):
        org = self.create_organization(owner=Factories.create_user())
        project = self.create_project(organization=org, name="foo")
        group = self.create_group(project=project)

        repo = Repository.objects.create(organization_id=org.id, name="test/repo")

        author = CommitAuthor.objects.create(
            name="foo bar baz", email="foo@example.com", organization_id=org.id
        )

        author2 = CommitAuthor.objects.create(
            name="foo bar boo", email="baroo@example.com", organization_id=org.id
        )

        author.preload_users()
        author2.preload_users()
        commit = Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            author=author,
            date_added="2019-03-01 12:00:00+00:00",
            message="fixes %s" % (group.qualified_short_id),
            key="alksdflskdfjsldkfajsflkslk",
        )
        commit2 = Commit.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            author=author2,
            date_added="2019-03-01 12:02:00+00:00",
            message="i fixed something",
            key="lskfslknsdkcsnlkdflksfdkls",
        )

        release = Release.objects.create(version="abcdabc", organization=org)
        release.add_project(project)
        release.set_commits(
            [
                {"id": commit.key, "repository": repo.name},
                {"id": commit2.key, "repository": repo.name},
            ]
        )
        # Confirm setup works
        assert ReleaseCommit.objects.filter(commit=commit, release=release).exists()
        assert ReleaseCommit.objects.filter(commit=commit2, release=release).exists()

        assert release.commit_count == 2
        assert release.authors == [str(author.id), str(author2.id)]
        assert release.last_commit_id == commit.id

        assert ReleaseHeadCommit.objects.filter(
            release_id=release.id, commit_id=commit.id, repository_id=repo.id
        ).exists()

        # Now clear the release;
        release.clear_commits()
        assert not ReleaseCommit.objects.filter(commit=commit, release=release).exists()
        assert not ReleaseCommit.objects.filter(commit=commit2, release=release).exists()
        assert not ReleaseHeadCommit.objects.filter(
            release_id=release.id, commit_id=commit.id, repository_id=repo.id
        ).exists()

        assert release.commit_count == 0
        assert release.authors == []
        assert not release.last_commit_id

        # Commits should still exist
        assert Commit.objects.filter(
            id=commit.id, organization_id=org.id, repository_id=repo.id
        ).exists()
        assert Commit.objects.filter(
            id=commit2.id, organization_id=org.id, repository_id=repo.id
        ).exists()
