from __future__ import annotations

from datetime import UTC, datetime
from typing import Any
from unittest.mock import patch
from uuid import uuid4

from rest_framework.exceptions import ErrorDetail

from sentry import tagstore
from sentry.api.endpoints.organization_releases import ReleaseSerializerWithProjects
from sentry.api.serializers import serialize
from sentry.api.serializers.models.release import GroupEventReleaseSerializer, get_users_for_authors
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.deploy import Deploy
from sentry.models.environment import Environment
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.releaseprojectenvironment import ReleaseProjectEnvironment, ReleaseStages
from sentry.models.releases.release_project import ReleaseProject
from sentry.silo.base import SiloMode
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import assume_test_silo_mode
from sentry.users.models.useremail import UserEmail


class ReleaseSerializerTest(TestCase, SnubaTestCase):
    def test_simple(self):
        user = self.create_user()
        project = self.create_project()
        project2 = self.create_project(organization=project.organization)
        release_version = uuid4().hex

        release = Release.objects.create(
            organization_id=project.organization_id, version=release_version
        )
        release.add_project(project)
        release.add_project(project2)

        ReleaseProject.objects.filter(release=release, project=project).update(new_groups=1)
        ReleaseProject.objects.filter(release=release, project=project2).update(new_groups=1)

        self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "release": release_version,
                "environment": "prod",
            },
            project_id=project.id,
        )

        release = Release.objects.get(version=release_version)
        commit_author = CommitAuthor.objects.create(
            name="stebe", email="stebe@sentry.io", organization_id=project.organization_id
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key="abc",
            author=commit_author,
            message="waddap",
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )
        release.update(authors=[str(commit_author.id)], commit_count=1, last_commit_id=commit.id)

        result = serialize(release, user)
        assert result["version"] == release.version
        # should be sum of all projects
        assert result["newGroups"] == 2
        (tagvalue1,) = tagstore.backend.get_release_tags(
            1, [project.id], environment_id=None, versions=[release_version]
        )
        assert result["lastEvent"] == tagvalue1.last_seen
        assert result["commitCount"] == 1
        assert result["authors"] == [{"name": "stebe", "email": "stebe@sentry.io"}]

        assert result["version"] == release.version
        assert result["versionInfo"]["package"] is None
        assert result["versionInfo"]["version"]["raw"] == release_version
        assert result["versionInfo"]["buildHash"] == release_version
        assert result["versionInfo"]["description"] == release_version[:12]

        current_formatted_datetime = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%S+00:00")
        current_project_meta = {
            "prev_release_version": "foobar@1.0.0",
            "next_release_version": "foobar@2.0.0",
            "sessions_lower_bound": current_formatted_datetime,
            "sessions_upper_bound": current_formatted_datetime,
            "first_release_version": "foobar@1.0.0",
            "last_release_version": "foobar@2.0.0",
        }

        result = serialize(
            release, user, project=project, current_project_meta=current_project_meta
        )
        assert result["newGroups"] == 1
        assert result["firstEvent"] == tagvalue1.first_seen
        assert result["lastEvent"] == tagvalue1.last_seen

        assert (
            result["currentProjectMeta"]["prevReleaseVersion"]
            == current_project_meta["prev_release_version"]
        )
        assert (
            result["currentProjectMeta"]["nextReleaseVersion"]
            == current_project_meta["next_release_version"]
        )
        assert (
            result["currentProjectMeta"]["sessionsLowerBound"]
            == current_project_meta["sessions_lower_bound"]
        )
        assert (
            result["currentProjectMeta"]["sessionsUpperBound"]
            == current_project_meta["sessions_upper_bound"]
        )
        assert (
            result["currentProjectMeta"]["firstReleaseVersion"]
            == current_project_meta["first_release_version"]
        )
        assert (
            result["currentProjectMeta"]["lastReleaseVersion"]
            == current_project_meta["last_release_version"]
        )

    def test_mobile_version(self):
        user = self.create_user()
        project = self.create_project()
        release_version = "foo.bar.BazApp@1.0a+20200101100"

        release = Release.objects.create(
            organization_id=project.organization_id, version=release_version
        )
        release.add_project(project)

        ReleaseProject.objects.filter(release=release, project=project).update(new_groups=1)

        self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "release": release_version,
                "environment": "prod",
            },
            project_id=project.id,
        )

        release = Release.objects.get(version=release_version)

        result = serialize(release, user)
        assert result["version"] == release.version
        assert result["versionInfo"]["package"] == "foo.bar.BazApp"
        assert result["versionInfo"]["version"]["raw"] == "1.0a+20200101100"
        assert result["versionInfo"]["version"]["major"] == 1
        assert result["versionInfo"]["version"]["minor"] == 0
        assert result["versionInfo"]["version"]["patch"] == 0
        assert result["versionInfo"]["version"]["pre"] == "a"
        assert result["versionInfo"]["version"]["buildCode"] == "20200101100"
        assert result["versionInfo"]["buildHash"] is None
        assert result["versionInfo"]["description"] == "1.0a (20200101100)"
        assert result["versionInfo"]["version"]["components"] == 2

    def test_no_tag_data(self):
        user = self.create_user()
        project = self.create_project()
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex
        )
        release.add_project(project)
        commit_author = CommitAuthor.objects.create(
            name="stebe", email="stebe@sentry.io", organization_id=project.organization_id
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key="abc",
            author=commit_author,
            message="waddap",
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )

        result = serialize(release, user)
        assert result["version"] == release.version
        assert not result["firstEvent"]
        assert not result["lastEvent"]

    def test_get_user_from_email(self):
        # upper case so we can test case sensitivity
        user = self.create_user(email="Stebe@sentry.io")
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex, new_groups=1
        )
        release.add_project(project)
        commit_author = CommitAuthor.objects.create(
            name="stebe", email="stebe@sentry.io", organization_id=project.organization_id
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key="abc",
            author=commit_author,
            message="waddap",
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )
        release.update(authors=[str(commit_author.id)], commit_count=1, last_commit_id=commit.id)

        result = serialize(release, user)
        result_author = result["authors"][0]
        assert int(result_author["id"]) == user.id
        assert result_author["email"] == user.email
        assert result_author["username"] == user.username

    def test_get_single_user_from_email(self):
        """
        Tests that the first useremail will be used to
        associate a user with a commit author email
        """
        user = self.create_user(email="stebe@sentry.io")
        otheruser = self.create_user(email="adifferentstebe@sentry.io")
        self.create_useremail(email="stebe@sentry.io", user=otheruser)
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)
        self.create_member(user=otheruser, organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex, new_groups=1
        )
        release.add_project(project)
        commit_author = CommitAuthor.objects.create(
            name="stebe", email="stebe@sentry.io", organization_id=project.organization_id
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key="abc",
            author=commit_author,
            message="waddap",
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )

        release.update(authors=[str(commit_author.id)], commit_count=1, last_commit_id=commit.id)

        result = serialize(release, user)
        assert len(result["authors"]) == 1
        result_author = result["authors"][0]
        assert int(result_author["id"]) == user.id
        assert result_author["email"] == user.email
        assert result_author["username"] == user.username

    def test_select_user_from_appropriate_org(self):
        """
        Tests that a user not belonging to the organization
        is not returned as the author
        """
        user = self.create_user(email="stebe@sentry.io")
        with assume_test_silo_mode(SiloMode.CONTROL):
            email = UserEmail.objects.get(user=user, email="stebe@sentry.io")
        otheruser = self.create_user(email="adifferentstebe@sentry.io")
        otheremail = self.create_useremail(email="stebe@sentry.io", user=otheruser)
        project = self.create_project()
        self.create_member(user=otheruser, organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex, new_groups=1
        )
        release.add_project(project)
        commit_author = CommitAuthor.objects.create(
            name="stebe", email="stebe@sentry.io", organization_id=project.organization_id
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key="abc",
            author=commit_author,
            message="waddap",
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )

        release.update(authors=[str(commit_author.id)], commit_count=1, last_commit_id=commit.id)

        assert email.id < otheremail.id
        result = serialize(release, user)
        assert len(result["authors"]) == 1
        result_author = result["authors"][0]
        assert int(result_author["id"]) == otheruser.id
        assert result_author["email"] == otheruser.email
        assert result_author["username"] == otheruser.username

    def test_no_commit_author(self):
        user = self.create_user(email="stebe@sentry.io")
        otheruser = self.create_user(email="adifferentstebe@sentry.io")
        project = self.create_project()
        self.create_member(user=otheruser, organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex, new_groups=1
        )
        release.add_project(project)
        commit = Commit.objects.create(
            organization_id=project.organization_id, repository_id=1, key="abc", message="waddap"
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )

        result = serialize(release, user)
        assert result["authors"] == []

    def test_deduplicate_users(self):
        """
        Tests that the same user is not returned more than once
        if there are commits associated with multiple of their
        emails
        """
        email = "stebe@sentry.io"
        user = self.create_user(email=email)
        new_useremail = self.create_useremail(email="alsostebe@sentry.io", user=user)
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex, new_groups=1
        )
        release.add_project(project)
        commit_author1 = CommitAuthor.objects.create(
            name="stebe", email=email, organization_id=project.organization_id
        )
        commit_author2 = CommitAuthor.objects.create(
            name="stebe", email=new_useremail.email, organization_id=project.organization_id
        )
        commit1 = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key="abc",
            author=commit_author1,
            message="waddap",
        )
        commit2 = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key="cde",
            author=commit_author2,
            message="oh hi",
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit1,
            order=1,
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit2,
            order=2,
        )
        ReleaseProject.objects.filter(release=release, project=project).update(new_groups=1)
        release.update(
            authors=[str(commit_author1.id), str(commit_author2.id)],
            commit_count=2,
            last_commit_id=commit2.id,
        )
        result = serialize(release, user)
        assert len(result["authors"]) == 1
        assert result["authors"][0]["email"] == "stebe@sentry.io"

    def test_with_deploy(self):
        user = self.create_user()
        project = self.create_project()
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex
        )
        release.add_project(project)

        env = Environment.objects.create(organization_id=project.organization_id, name="production")
        env.add_project(project)
        ReleaseProjectEnvironment.objects.create(
            project_id=project.id, release_id=release.id, environment_id=env.id, new_issues_count=1
        )
        deploy = Deploy.objects.create(
            organization_id=project.organization_id, release=release, environment_id=env.id
        )
        release.update(total_deploys=1, last_deploy_id=deploy.id)

        result = serialize(release, user)
        assert result["version"] == release.version
        assert result["deployCount"] == 1
        assert result["lastDeploy"]["id"] == str(deploy.id)

    def test_release_no_users(self):
        """
        Testing when a repo gets deleted leaving dangling last commit id and author_ids
        Made the decision that the Serializer must handle the data even in the case that the
        commit_id or the author_ids point to records that do not exist.
        """
        commit_id = 9999999
        commit_author_id = 9999999

        project = self.create_project()
        release = Release.objects.create(
            organization_id=project.organization_id,
            version=uuid4().hex,
            authors=[str(commit_author_id)],
            commit_count=1,
            last_commit_id=commit_id,
        )
        release.add_project(project)
        serialize(release)

    def test_get_user_for_authors_simple(self):
        user = self.create_user(email="chrib@sentry.io")
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)
        author = CommitAuthor(
            email="chrib@sentry.io", name="Chrib", organization_id=project.organization_id
        )
        users = get_users_for_authors(organization_id=project.organization_id, authors=[author])
        assert len(users) == 1
        assert users[str(author.id)]["email"] == author.email

    def test_get_user_for_authors_no_user(self):
        author = CommitAuthor(email="notactuallyauser@sentry.io")
        project = self.create_project()
        users = get_users_for_authors(organization_id=project.organization_id, authors=[author])
        assert len(users) == 1
        assert users[str(author.id)]["email"] == author.email

    @patch("sentry.api.serializers.models.release.serialize")
    def test_get_user_for_authors_caching(self, patched_serialize_base):
        # Ensure the fetched/miss caching logic works.
        user = self.create_user(email="chrib@sentry.io")
        user2 = self.create_user(email="alsochrib@sentry.io")
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)
        self.create_member(user=user2, organization=project.organization)
        commit_author = CommitAuthor.objects.create(
            email="chrib@sentry.io", name="Chrib", organization_id=project.organization_id
        )
        commit_author2 = CommitAuthor.objects.create(
            email="alsochrib@sentry.io", name="Also Chrib", organization_id=project.organization_id
        )

        users = get_users_for_authors(
            organization_id=project.organization_id, authors=[commit_author]
        )
        assert len(users) == 1
        assert users[str(commit_author.id)]["email"] == user.email
        patched_serialize_base.call_count = 1
        users = get_users_for_authors(
            organization_id=project.organization_id, authors=[commit_author]
        )
        assert len(users) == 1
        assert users[str(commit_author.id)]["email"] == user.email
        patched_serialize_base.call_count = 1
        users = get_users_for_authors(
            organization_id=project.organization_id, authors=[commit_author, commit_author2]
        )
        assert len(users) == 2
        assert users[str(commit_author.id)]["email"] == user.email
        assert users[str(commit_author2.id)]["email"] == user2.email
        patched_serialize_base.call_count = 2
        users = get_users_for_authors(
            organization_id=project.organization_id, authors=[commit_author, commit_author2]
        )
        assert len(users) == 2
        assert users[str(commit_author.id)]["email"] == user.email
        assert users[str(commit_author2.id)]["email"] == user2.email
        patched_serialize_base.call_count = 2

    def test_adoption_stages(self):
        user = self.create_user()
        project = self.create_project()
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex
        )
        release.add_project(project)
        env = Environment.objects.create(organization_id=project.organization_id, name="staging")
        env.add_project(project)
        ReleaseProjectEnvironment.objects.create(
            project_id=project.id, release_id=release.id, environment_id=env.id, new_issues_count=1
        )
        result = serialize(release, user)
        assert "adoptionStages" not in result

        result = serialize(release, user)
        assert "adoptionStages" not in result

        result = serialize(release, user, with_adoption_stages=True)
        assert result["adoptionStages"][project.slug]["stage"] == ReleaseStages.LOW_ADOPTION
        assert result["adoptionStages"][project.slug]["unadopted"] is None
        assert result["adoptionStages"][project.slug]["adopted"] is None

        env2 = Environment.objects.create(
            organization_id=project.organization_id, name="production"
        )
        rpe = ReleaseProjectEnvironment.objects.create(
            project_id=project.id,
            release_id=release.id,
            environment_id=env2.id,
            new_issues_count=1,
            adopted=datetime.now(UTC),
        )

        result = serialize(release, user, with_adoption_stages=True)
        assert result["adoptionStages"][project.slug]["stage"] == ReleaseStages.ADOPTED
        assert result["adoptionStages"][project.slug]["unadopted"] is None
        assert result["adoptionStages"][project.slug]["adopted"] is not None

        project2 = self.create_project()
        ReleaseProjectEnvironment.objects.create(
            project_id=project2.id,
            release_id=release.id,
            environment_id=env2.id,
            new_issues_count=1,
        )
        result = serialize(release, user, with_adoption_stages=True)
        assert result["adoptionStages"][project.slug]["stage"] == ReleaseStages.ADOPTED
        assert result["adoptionStages"][project2.slug]["stage"] == ReleaseStages.LOW_ADOPTION

        ReleaseProjectEnvironment.objects.create(
            project_id=project2.id,
            release_id=release.id,
            environment_id=env.id,
            new_issues_count=1,
            adopted=datetime.now(UTC),
        )
        result = serialize(release, user, with_adoption_stages=True)
        assert result["adoptionStages"][project.slug]["stage"] == ReleaseStages.ADOPTED
        assert result["adoptionStages"][project2.slug]["stage"] == ReleaseStages.ADOPTED

        rpe.update(unadopted=datetime.now(UTC))
        result = serialize(release, user, with_adoption_stages=True)
        assert result["adoptionStages"][project.slug]["stage"] == ReleaseStages.REPLACED
        assert result["adoptionStages"][project2.slug]["stage"] == ReleaseStages.ADOPTED


class ReleaseRefsSerializerTest(TestCase):
    def test_simple(self):
        # test bad refs
        data: dict[str, Any] = {"version": "a" * 40, "projects": ["earth"], "refs": [None]}

        serializer = ReleaseSerializerWithProjects(data=data)

        assert not serializer.is_valid()
        assert serializer.errors == {
            "refs": [ErrorDetail("This field may not be null.", code="null")]
        }

        # test good refs
        data = {
            "version": "a" * 40,
            "projects": ["earth"],
            "refs": [{"repository": "my-repo", "commit": "b" * 40}],
        }

        serializer = ReleaseSerializerWithProjects(data=data)

        assert serializer.is_valid()


class GroupEventReleaseSerializerTest(TestCase, SnubaTestCase):
    def test_simple(self):
        user = self.create_user()
        project = self.create_project()
        project2 = self.create_project(organization=project.organization)
        release_version = uuid4().hex

        release = Release.objects.create(
            organization_id=project.organization_id, version=release_version
        )
        release.add_project(project)
        release.add_project(project2)

        ReleaseProject.objects.filter(release=release, project=project).update(new_groups=1)
        ReleaseProject.objects.filter(release=release, project=project2).update(new_groups=1)

        self.store_event(
            data={
                "timestamp": before_now(seconds=1).isoformat(),
                "release": release_version,
                "environment": "prod",
            },
            project_id=project.id,
        )

        release = Release.objects.get(version=release_version)
        env = Environment.objects.create(organization_id=project.organization_id, name="production")
        env.add_project(project)
        commit_author = CommitAuthor.objects.create(
            name="stebe", email="stebe@sentry.io", organization_id=project.organization_id
        )
        commit = Commit.objects.create(
            organization_id=project.organization_id,
            repository_id=1,
            key="abc",
            author=commit_author,
            message="waddap",
        )
        ReleaseCommit.objects.create(
            organization_id=project.organization_id,
            project_id=project.id,
            release=release,
            commit=commit,
            order=1,
        )
        release.update(authors=[str(commit_author.id)], commit_count=1, last_commit_id=commit.id)

        deploy = Deploy.objects.create(
            organization_id=project.organization_id, release=release, environment_id=env.id
        )
        release.update(total_deploys=1, last_deploy_id=deploy.id)

        result = serialize(release, user, GroupEventReleaseSerializer())

        assert result["id"] == release.id
        assert result["commitCount"] == 1
        assert result["data"] == release.data
        assert result["dateReleased"] == release.date_released
        assert result["deployCount"] == release.total_deploys
        assert result["ref"] == release.ref
        assert result["lastCommit"]["id"] == commit.key
        assert result["lastDeploy"]["id"] == str(deploy.id)

        assert result["version"] == release.version
        assert result["versionInfo"]["package"] is None
        assert result["versionInfo"]["version"]["raw"] == release_version
        assert result["versionInfo"]["buildHash"] == release_version
        assert result["versionInfo"]["description"] == release_version[:12]
