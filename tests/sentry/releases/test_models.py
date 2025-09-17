from hashlib import sha1
from uuid import uuid4

from sentry.models.repository import Repository
from sentry.releases.models import Commit, CommitFileChange
from sentry.testutils.cases import TestCase


class FindReferencedGroupsTest(TestCase):
    def test_multiple_matches_basic(self) -> None:
        group = self.create_group()
        group2 = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id} {group2.qualified_short_id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 2
        assert group in groups
        assert group2 in groups

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\\Resolved {group.qualified_short_id} {group2.qualified_short_id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 2
        assert group in groups
        assert group2 in groups

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\\Close {group.qualified_short_id} {group2.qualified_short_id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 2
        assert group in groups
        assert group2 in groups

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes: {group.qualified_short_id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups

    def test_multiple_matches_comma_separated(self) -> None:
        group = self.create_group()
        group2 = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}, {group2.qualified_short_id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 2
        assert group in groups
        assert group2 in groups

    def test_markdown_links(self) -> None:
        group = self.create_group()
        group2 = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes [{group.qualified_short_id}](https://sentry.io/), [{group2.qualified_short_id}](https://sentry.io/)",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 2
        assert group in groups
        assert group2 in groups


class CommitFileChangeTest(TestCase):
    def test_get_count_for_commits(self) -> None:
        group = self.create_group()
        organization_id = group.organization.id
        repo = Repository.objects.create(name="example", organization_id=organization_id)
        commit = Commit.objects.create(
            key="a" * 40,
            repository_id=repo.id,
            organization_id=organization_id,
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
        )
        CommitFileChange.objects.create(
            organization_id=organization_id, commit_id=commit.id, filename=".gitignore", type="M"
        )

        count = CommitFileChange.objects.get_count_for_commits([commit])
        assert count == 1
