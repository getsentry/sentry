from __future__ import annotations

from datetime import UTC, datetime
from typing import int, Any
from unittest.mock import MagicMock, patch
from uuid import uuid4

from rest_framework.exceptions import ErrorDetail

from sentry import tagstore
from sentry.api.endpoints.organization_releases import ReleaseSerializerWithProjects
from sentry.api.serializers import serialize
from sentry.api.serializers.models.release import GroupEventReleaseSerializer, get_users_for_authors
from sentry.integrations.models.external_actor import ExternalActor
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
    def test_simple(self) -> None:
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

    def test_authors_is_none(self) -> None:
        release = Release.objects.create(
            organization_id=self.organization.id, version="1", authors=None
        )
        release.add_project(self.project)
        result = serialize(release, self.user)
        assert result["authors"] == []

    def test_mobile_version(self) -> None:
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

    def test_no_tag_data(self) -> None:
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

    def test_get_user_from_email(self) -> None:
        # upper case so we can test case sensitivity
        user = self.create_user(email="Stebe@sentry.io")
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)
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
        release.update(authors=[str(commit_author.id)], commit_count=1, last_commit_id=commit.id)

        result = serialize(release, user)
        result_author = result["authors"][0]
        assert int(result_author["id"]) == user.id
        assert result_author["email"] == user.email
        assert result_author["username"] == user.username

    def test_get_single_user_from_email(self) -> None:
        """
        If 1 commit author email links to 2 users - prefer user with this as their primary email.
        """
        user = self.create_user(email="stebe@sentry.io")
        otheruser = self.create_user(email="adifferentstebe@sentry.io")
        self.create_useremail(email="stebe@sentry.io", user=otheruser)
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)
        self.create_member(user=otheruser, organization=project.organization)
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

        release.update(authors=[str(commit_author.id)], commit_count=1, last_commit_id=commit.id)

        result = serialize(release, user)
        assert len(result["authors"]) == 1
        result_author = result["authors"][0]
        assert int(result_author["id"]) == user.id
        assert result_author["email"] == user.email
        assert result_author["username"] == user.username

    def test_select_user_from_appropriate_org(self) -> None:
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

        release.update(authors=[str(commit_author.id)], commit_count=1, last_commit_id=commit.id)

        assert email.id < otheremail.id
        result = serialize(release, user)
        assert len(result["authors"]) == 1
        result_author = result["authors"][0]
        assert int(result_author["id"]) == otheruser.id
        assert result_author["email"] == otheruser.email
        assert result_author["username"] == otheruser.username

    def test_no_commit_author(self) -> None:
        user = self.create_user(email="stebe@sentry.io")
        otheruser = self.create_user(email="adifferentstebe@sentry.io")
        project = self.create_project()
        self.create_member(user=otheruser, organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex
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

    def test_deduplicate_users(self) -> None:
        """
        Tests that the same user is not returned more than once
        if there are commits associated with multiple of their emails.
        """
        email = "stebe@sentry.io"
        user = self.create_user(email=email)
        new_useremail = self.create_useremail(email="alsostebe@sentry.io", user=user)
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)
        release = Release.objects.create(
            organization_id=project.organization_id, version=uuid4().hex
        )
        release.add_project(project)
        commit_author1 = CommitAuthor.objects.create(
            name="stebe", email=email, organization_id=project.organization_id, external_id=None
        )
        commit_author2 = CommitAuthor.objects.create(
            name="stebe",
            email=new_useremail.email,
            organization_id=project.organization_id,
            external_id=None,
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
        assert result["newGroups"] == 1

    def test_with_deploy(self) -> None:
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

    def test_release_no_users(self) -> None:
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

    def test_get_user_for_authors_simple(self) -> None:
        user = self.create_user(email="chrib@sentry.io")
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)
        author = CommitAuthor(
            email="chrib@sentry.io", name="Chrib", organization_id=project.organization_id
        )
        users = get_users_for_authors(organization_id=project.organization_id, authors=[author])
        assert len(users) == 1
        assert users[str(author.id)]["email"] == author.email

    def test_get_user_for_authors_no_user(self) -> None:
        author = CommitAuthor(email="notactuallyauser@sentry.io")
        project = self.create_project()
        users = get_users_for_authors(organization_id=project.organization_id, authors=[author])
        assert len(users) == 1
        assert users[str(author.id)]["email"] == author.email

    @patch("sentry.api.serializers.models.release.serialize")
    def test_get_user_for_authors_caching(self, patched_serialize_base: MagicMock) -> None:
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

    def test_adoption_stages(self) -> None:
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

    def test_with_none_new_groups(self) -> None:
        """Test that release serializer works correctly when new_groups is None."""
        project = self.create_project()

        release = Release.objects.create(
            organization_id=project.organization_id,
            version="0.1",
        )
        release.add_project(project)

        ReleaseProject.objects.filter(release=release, project=project).update(new_groups=None)

        result = serialize(release, user=self.user, project=project)

        assert result["version"] == "0.1"
        assert result["newGroups"] == 0  # Should default to 0 when None

    def test_new_groups_single_release(self) -> None:
        """
        Test new groups counts for one release with multiple projects, each having different issue counts.
        """
        project_a = self.create_project(name="Project A", slug="project-a")
        project_b = self.create_project(
            name="Project B", slug="project-b", organization=project_a.organization
        )

        release_version = "1.0.0"
        release = Release.objects.create(
            organization_id=project_a.organization_id, version=release_version
        )
        release.add_project(project_a)
        release.add_project(project_b)

        # 3 new groups for project A, 2 new groups for project B
        ReleaseProject.objects.filter(release=release, project=project_a).update(new_groups=3)
        ReleaseProject.objects.filter(release=release, project=project_b).update(new_groups=2)

        result = serialize(release, self.user)
        assert result["newGroups"] == 5

        projects = {p["id"]: p for p in result["projects"]}
        assert projects[project_a.id]["newGroups"] == 3
        assert projects[project_b.id]["newGroups"] == 2

        assert projects[project_a.id]["name"] == "Project A"
        assert projects[project_a.id]["slug"] == "project-a"
        assert projects[project_b.id]["name"] == "Project B"
        assert projects[project_b.id]["slug"] == "project-b"

    def test_new_groups_multiple_releases(self) -> None:
        """
        Test new groups count for multiple releases per project.
        """
        project_a = self.create_project(name="Project A", slug="project-a")
        project_b = self.create_project(
            name="Project B", slug="project-b", organization=project_a.organization
        )

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

        # 1. Serialize Release 1.0.0
        result = serialize(release_1, self.user)
        assert result["version"] == "1.0.0"
        assert result["newGroups"] == 5
        projects = {p["id"]: p for p in result["projects"]}
        assert projects[project_a.id]["newGroups"] == 3
        assert projects[project_b.id]["newGroups"] == 2

        # 2. Serialize Release 2.0.0
        result = serialize(release_2, self.user)
        assert result["version"] == "2.0.0"
        assert result["newGroups"] == 5
        projects = {p["id"]: p for p in result["projects"]}
        assert projects[project_a.id]["newGroups"] == 1
        assert projects[project_b.id]["newGroups"] == 4

        # 3. Serialize both releases together
        result = serialize([release_1, release_2], self.user)
        assert len(result) == 2
        serialized_releases = {r["version"]: r for r in result}
        serialized_release_1 = serialized_releases["1.0.0"]
        serialized_release_2 = serialized_releases["2.0.0"]
        assert serialized_release_1["newGroups"] == 5
        assert serialized_release_2["newGroups"] == 5
        projects_1 = {p["id"]: p for p in serialized_release_1["projects"]}
        projects_2 = {p["id"]: p for p in serialized_release_2["projects"]}
        assert projects_1[project_a.id]["newGroups"] == 3
        assert projects_1[project_b.id]["newGroups"] == 2
        assert projects_2[project_a.id]["newGroups"] == 1
        assert projects_2[project_b.id]["newGroups"] == 4

    def test_new_groups_environment_filtering(self) -> None:
        """
        Test new group counts for a single release with environment filtering.
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
        ReleaseProjectEnvironment.objects.create(
            release=release, project=project_b, environment=staging, new_issues_count=0
        )

        # 1. No environment filter
        result = serialize(release, self.user)
        projects = {p["id"]: p for p in result["projects"]}
        assert projects[project_a.id]["newGroups"] == 4
        assert projects[project_b.id]["newGroups"] == 2
        assert result["newGroups"] == 6

        # 2. Filter by production environment
        result = serialize(release, self.user, environments=["production"])
        projects = {p["id"]: p for p in result["projects"]}
        assert projects[project_a.id]["newGroups"] == 3
        assert projects[project_b.id]["newGroups"] == 2
        assert result["newGroups"] == 5

        # 3. Filter by staging environment
        result = serialize(release, self.user, environments=["staging"])
        projects = {p["id"]: p for p in result["projects"]}
        assert projects[project_a.id]["newGroups"] == 1
        assert projects[project_b.id]["newGroups"] == 0
        assert result["newGroups"] == 1

        # 4. Filter by both environments
        result = serialize(release, self.user, environments=["production", "staging"])
        projects = {p["id"]: p for p in result["projects"]}
        assert projects[project_a.id]["newGroups"] == 4
        assert projects[project_b.id]["newGroups"] == 2
        assert result["newGroups"] == 6

    def test_new_groups_multiple_releases_environment_filtering(self) -> None:
        """
        Test new group counts for multiple releases with different environments.
        """
        project_a = self.create_project(name="Project A", slug="project-a")
        project_b = self.create_project(
            name="Project B", slug="project-b", organization=project_a.organization
        )

        production = self.create_environment(name="production", organization=project_a.organization)
        staging = self.create_environment(name="staging", organization=project_a.organization)

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

        # Release 1.0.0: Project A = 4 (3+1), Project B = 2 (2+0)
        ReleaseProject.objects.filter(release=release_1, project=project_a).update(new_groups=4)
        ReleaseProject.objects.filter(release=release_1, project=project_b).update(new_groups=2)
        # Release 2.0.0: Project A = 3 (1+2), Project B = 5 (4+1)
        ReleaseProject.objects.filter(release=release_2, project=project_a).update(new_groups=3)
        ReleaseProject.objects.filter(release=release_2, project=project_b).update(new_groups=5)

        # Release 1.0.0 - Project A: 3 in production, 1 in staging
        ReleaseProjectEnvironment.objects.create(
            release=release_1, project=project_a, environment=production, new_issues_count=3
        )
        ReleaseProjectEnvironment.objects.create(
            release=release_1, project=project_a, environment=staging, new_issues_count=1
        )
        # Release 1.0.0 - Project B: 2 in production, 0 in staging (no staging record)
        ReleaseProjectEnvironment.objects.create(
            release=release_1, project=project_b, environment=production, new_issues_count=2
        )
        # Release 2.0.0 - Project A: 1 in production, 2 in staging
        ReleaseProjectEnvironment.objects.create(
            release=release_2, project=project_a, environment=production, new_issues_count=1
        )
        ReleaseProjectEnvironment.objects.create(
            release=release_2, project=project_a, environment=staging, new_issues_count=2
        )
        # Release 2.0.0 - Project B: 4 in production, 1 in staging
        ReleaseProjectEnvironment.objects.create(
            release=release_2, project=project_b, environment=production, new_issues_count=4
        )
        ReleaseProjectEnvironment.objects.create(
            release=release_2, project=project_b, environment=staging, new_issues_count=1
        )

        # 1. Serialize Release 1.0.0 with no environment filter
        result = serialize(release_1, self.user)
        assert result["newGroups"] == 6
        projects = {p["id"]: p for p in result["projects"]}
        assert projects[project_a.id]["newGroups"] == 4
        assert projects[project_b.id]["newGroups"] == 2

        # 2. Serialize Release 1.0.0 with production filter
        result = serialize(release_1, self.user, environments=["production"])
        assert result["version"] == "1.0.0"
        assert result["newGroups"] == 5
        projects = {p["id"]: p for p in result["projects"]}
        assert projects[project_a.id]["newGroups"] == 3
        assert projects[project_b.id]["newGroups"] == 2

        # 3. Serialize Release 2.0.0 with production filter
        result = serialize(release_2, self.user, environments=["production"])
        assert result["version"] == "2.0.0"
        assert result["newGroups"] == 5
        projects = {p["id"]: p for p in result["projects"]}
        assert projects[project_a.id]["newGroups"] == 1
        assert projects[project_b.id]["newGroups"] == 4

        # 4. Serialize both releases with production filter
        result = serialize([release_1, release_2], self.user, environments=["production"])
        assert len(result) == 2
        serialized_releases = {r["version"]: r for r in result}
        serialized_release_1 = serialized_releases["1.0.0"]
        serialized_release_2 = serialized_releases["2.0.0"]
        assert serialized_release_1["newGroups"] == 5
        assert serialized_release_2["newGroups"] == 5
        projects_1 = {p["id"]: p for p in serialized_release_1["projects"]}
        projects_2 = {p["id"]: p for p in serialized_release_2["projects"]}
        assert projects_1[project_a.id]["newGroups"] == 3
        assert projects_1[project_b.id]["newGroups"] == 2
        assert projects_2[project_a.id]["newGroups"] == 1
        assert projects_2[project_b.id]["newGroups"] == 4


class ReleaseRefsSerializerTest(TestCase):
    def test_simple(self) -> None:
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
    def test_simple(self) -> None:
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


class GetUsersForAuthorsUserMappingsTest(TestCase):
    def test_get_users_for_authors_finds_by_username(self) -> None:
        user = self.create_user(email="john@company.com", name="John Smith")
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)
        integration = self.create_provider_integration(provider="github")
        self.create_organization_integration(
            organization_id=project.organization_id, integration_id=integration.id
        )
        ExternalActor.objects.create(
            external_name="@johnsmith",
            user_id=user.id,
            organization_id=project.organization_id,
            integration_id=integration.id,
            provider=200,
        )
        # CommitAuthor with anonymous email
        author = CommitAuthor.objects.create(
            email="34950490+johnsmith@users.noreply.github.com",
            name="Other",
            external_id="github:johnsmith",
            organization_id=project.organization_id,
        )

        users = get_users_for_authors(organization_id=project.organization_id, authors=[author])
        assert len(users) == 1
        assert users[str(author.id)].get("id", "not present") == str(user.id)
        assert users[str(author.id)]["email"] == "john@company.com"
        assert users[str(author.id)]["name"] == "John Smith"

    def test_get_users_for_authors_by_external_actor_no_user_id(self) -> None:
        """CommitAuthor has an ExternalActor but it's a team mapping"""
        project = self.create_project()
        integration = self.create_provider_integration(provider="github")
        self.create_organization_integration(
            organization_id=project.organization_id, integration_id=integration.id
        )
        team = self.create_team(organization=project.organization)
        ExternalActor.objects.create(
            external_name="@teamuser",
            team_id=team.id,
            organization_id=project.organization_id,
            integration_id=integration.id,
            provider=200,
        )
        author = CommitAuthor.objects.create(
            email="teamuser@company.com",
            name="Team User",
            external_id="github:teamuser",
            organization_id=project.organization_id,
        )

        users = get_users_for_authors(organization_id=project.organization_id, authors=[author])
        assert len(users) == 1
        assert users[str(author.id)].get("id", "not present") == "not present"
        assert users[str(author.id)]["email"] == "teamuser@company.com"
        assert users[str(author.id)]["name"] == "Team User"

    def test_get_users_for_authors_no_match(self) -> None:
        project = self.create_project()
        author = CommitAuthor.objects.create(
            email="unknown@company.com",
            name="Unknown User",
            external_id="github:unknownuser",
            organization_id=project.organization_id,
        )

        users = get_users_for_authors(organization_id=project.organization_id, authors=[author])
        assert len(users) == 1
        assert users[str(author.id)].get("id", "not present") == "not present"
        assert users[str(author.id)]["email"] == "unknown@company.com"
        assert users[str(author.id)]["name"] == "Unknown User"

    def test_get_users_for_authors_finds_by_email(self) -> None:
        user = self.create_user(email="regular@company.com", name="Regular Sentry User")
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)

        author = CommitAuthor.objects.create(
            email="regular@company.com",
            name="Regular User",
            external_id="github:regularuser",
            organization_id=project.organization_id,
        )

        users = get_users_for_authors(organization_id=project.organization_id, authors=[author])

        assert len(users) == 1
        assert users[str(author.id)].get("id", "not present") == str(user.id)
        assert users[str(author.id)]["email"] == "regular@company.com"
        assert users[str(author.id)]["name"] == "Regular Sentry User"

    def test_get_users_for_authors_external_actor_takes_precedence(self) -> None:
        email_user = self.create_user(email="john@company.com", name="Email User")
        mapping_user = self.create_user(email="john-external@company.com", name="external User")
        project = self.create_project()
        self.create_member(user=email_user, organization=project.organization)
        self.create_member(user=mapping_user, organization=project.organization)
        integration = self.create_provider_integration(provider="github")
        self.create_organization_integration(
            organization_id=project.organization_id, integration_id=integration.id
        )
        ExternalActor.objects.create(
            external_name="@johnsmith",
            user_id=mapping_user.id,
            organization_id=project.organization_id,
            integration_id=integration.id,
            provider=200,
        )
        author = CommitAuthor.objects.create(
            email="john@company.com",  # matches email_user
            name="John Smith",
            external_id="github:johnsmith",  # matches ExternalActor
            organization_id=project.organization_id,
        )

        users = get_users_for_authors(organization_id=project.organization_id, authors=[author])
        assert len(users) == 1
        assert users[str(author.id)].get("id", "not present") == str(mapping_user.id)
        assert users[str(author.id)]["email"] == "john-external@company.com"
        assert users[str(author.id)]["name"] == "external User"

    def test_get_users_for_authors_mixed_authors(self) -> None:
        project = self.create_project()
        integration = self.create_provider_integration(provider="github")
        self.create_organization_integration(
            organization_id=project.organization_id, integration_id=integration.id
        )
        email_user1 = self.create_user(email="direct1@company.com", name="Direct User 1")
        self.create_member(user=email_user1, organization=project.organization)
        email_user2 = self.create_user(email="direct2@company.com", name="Direct User 2")
        self.create_member(user=email_user2, organization=project.organization)

        external_user1 = self.create_user(email="external1@company.com", name="External User 1")
        self.create_member(user=external_user1, organization=project.organization)
        ExternalActor.objects.create(
            external_name="@externaluser1",
            user_id=external_user1.id,
            organization_id=project.organization_id,
            integration_id=integration.id,
            provider=200,
        )
        external_user2 = self.create_user(email="external2@company.com", name="External User 2")
        self.create_member(user=external_user2, organization=project.organization)
        ExternalActor.objects.create(
            external_name="@externaluser2",
            user_id=external_user2.id,
            organization_id=project.organization_id,
            integration_id=integration.id,
            provider=200,
        )

        authors = [
            CommitAuthor.objects.create(
                email="direct1@company.com",
                name="Commit Author Name 1",
                external_id="github:directuser1",
                organization_id=project.organization_id,
            ),
            CommitAuthor.objects.create(
                email="direct2@company.com",
                name="Commit Author Name 2",
                external_id="github:directuser2",
                organization_id=project.organization_id,
            ),
            CommitAuthor.objects.create(
                email="12345+externaluser1@users.noreply.github.com",
                name="Commit Author Name 3",
                external_id="github:externaluser1",
                organization_id=project.organization_id,
            ),
            CommitAuthor.objects.create(
                email="67890+externaluser2@users.noreply.github.com",
                name="Commit Author Name 4",
                external_id="github:externaluser2",
                organization_id=project.organization_id,
            ),
            CommitAuthor.objects.create(
                email="unknown1@company.com",
                name="Commit Author Name 5",
                external_id="github:unknownuser1",
                organization_id=project.organization_id,
            ),
            CommitAuthor.objects.create(
                email="unknown2@company.com",
                name="Commit Author Name 6",
                external_id="unknownuser2",  # non-GH CommitAuthor
                organization_id=project.organization_id,
            ),
        ]

        users = get_users_for_authors(organization_id=project.organization_id, authors=authors)
        assert len(users) == 6

        assert users[str(authors[0].id)].get("id", "not present") == str(email_user1.id)
        assert users[str(authors[0].id)]["email"] == "direct1@company.com"
        assert users[str(authors[0].id)]["name"] == "Direct User 1"
        assert users[str(authors[1].id)].get("id", "not present") == str(email_user2.id)
        assert users[str(authors[1].id)]["email"] == "direct2@company.com"
        assert users[str(authors[1].id)]["name"] == "Direct User 2"

        # ExternalActor resolution assertions (takes precedence over email)
        assert users[str(authors[2].id)].get("id", "not present") == str(external_user1.id)
        assert users[str(authors[2].id)]["email"] == "external1@company.com"
        assert users[str(authors[2].id)]["name"] == "External User 1"
        assert users[str(authors[3].id)].get("id", "not present") == str(external_user2.id)
        assert users[str(authors[3].id)]["email"] == "external2@company.com"
        assert users[str(authors[3].id)]["name"] == "External User 2"

        # CommitAuthor fallback assertions
        assert users[str(authors[4].id)].get("id", "not present") == "not present"
        assert users[str(authors[4].id)]["email"] == "unknown1@company.com"
        assert users[str(authors[4].id)]["name"] == "Commit Author Name 5"
        assert users[str(authors[5].id)].get("id", "not present") == "not present"
        assert users[str(authors[5].id)]["email"] == "unknown2@company.com"
        assert users[str(authors[5].id)]["name"] == "Commit Author Name 6"

    def test_get_users_for_authors_multiple_emails(self) -> None:
        user = self.create_user(email="regular@company.com", name="Regular Sentry User")
        self.create_useremail(user=user, email="backup_email@gmail.com")
        project = self.create_project()
        self.create_member(user=user, organization=project.organization)

        author = CommitAuthor.objects.create(
            email="backup_email@gmail.com",
            name="RU",
            external_id="github:regularuser",
            organization_id=project.organization_id,
        )

        users = get_users_for_authors(organization_id=project.organization_id, authors=[author])

        assert len(users) == 1
        assert users[str(author.id)].get("id", "not present") == str(user.id)
        assert users[str(author.id)]["email"] == "regular@company.com"  # returns primary email
        assert users[str(author.id)]["name"] == "Regular Sentry User"

    @patch("sentry.users.services.user.service.user_service.serialize_many")
    def test_get_users_for_authors_user_dropped(self, mock_serialize) -> None:
        """Edge case: user ID is found but doesn't come back from serialize_many"""
        project = self.create_project()
        user = self.create_user(email="found@company.com", name="Found User")
        self.create_member(user=user, organization=project.organization)

        integration = self.create_provider_integration(provider="github")
        self.create_organization_integration(
            organization_id=project.organization_id, integration_id=integration.id
        )

        author = CommitAuthor.objects.create(
            email="found@company.com",
            name="CommitAuthor Fallback Name",
            external_id="github:founduser",
            organization_id=project.organization_id,
        )

        mock_serialize.return_value = []  # User ID found but not serialized
        users = get_users_for_authors(organization_id=project.organization_id, authors=[author])

        # fallback to CommitAuthor fields
        assert len(users) == 1
        assert users[str(author.id)].get("id", "not present") == "not present"
        assert users[str(author.id)]["email"] == "found@company.com"
        assert users[str(author.id)]["name"] == "CommitAuthor Fallback Name"

    def test_external_actor_duplicate_external_name_prefers_most_recent(self) -> None:
        """Edge case: ExternalActor objects with the same external_name
        map to multiple sentry users - select most recently created ExternalActor"""
        project = self.create_project()
        integration = self.create_provider_integration(provider="github")
        self.create_organization_integration(
            organization_id=project.organization_id, integration_id=integration.id
        )

        user0 = self.create_user(email="user0@company.com", name="User 0")
        self.create_member(user=user0, organization=project.organization)
        ExternalActor.objects.create(
            external_name="@duplicate_name",
            user_id=user0.id,
            organization_id=project.organization_id,
            integration_id=integration.id,
            provider=200,
        )

        user1 = self.create_user(email="user1@company.com", name="User 1")
        self.create_member(user=user1, organization=project.organization)
        ExternalActor.objects.create(
            external_name="@duplicate_name",
            user_id=user1.id,
            organization_id=project.organization_id,
            integration_id=integration.id,
            provider=200,
        )

        user2 = self.create_user(email="user2@company.com", name="User 2")
        self.create_member(user=user2, organization=project.organization)
        ExternalActor.objects.create(
            external_name="@duplicate_name",
            user_id=user2.id,
            organization_id=project.organization_id,
            integration_id=integration.id,
            provider=200,
        )

        author = CommitAuthor.objects.create(
            email="12345+duplicateuser@users.noreply.github.com",
            name="Duplicate User Commit Name",
            external_id="github:duplicate_name",
            organization_id=project.organization_id,
        )

        users = get_users_for_authors(organization_id=project.organization_id, authors=[author])

        assert len(users) == 1
        assert users[str(author.id)].get("id", "not present") == str(user2.id)
        assert users[str(author.id)]["email"] == "user2@company.com"
        assert users[str(author.id)]["name"] == "User 2"
