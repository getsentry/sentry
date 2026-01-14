from hashlib import sha1
from uuid import uuid4

from sentry.models.commit import Commit
from sentry.models.repository import Repository
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

    def test_sentry_issue_url_with_numeric_id(self) -> None:
        """Test that pasting a Sentry issue URL with numeric ID works"""
        group = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        # Test URL with org slug format
        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Fixes n+1 query\n\nhttps://sentry.io/organizations/test-org/issues/{group.id}/",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups

    def test_sentry_issue_url_short_format(self) -> None:
        """Test URL in short format like https://sentry.sentry.io/issues/123/"""
        group = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Fix n+1 issue\n\nhttps://sentry.sentry.io/issues/{group.id}/",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups

    def test_sentry_issue_url_with_short_id(self) -> None:
        """Test that URLs with short IDs like SENTRY-123 work"""
        group = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Fix bug\n\nhttps://sentry.io/organizations/test-org/issues/{group.qualified_short_id}/",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups

    def test_sentry_issue_url_without_fixes_keyword(self) -> None:
        """Test that issue URLs work even without 'Fixes' keyword"""
        group = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Reduce insert # on /broadcasts/\n\nn+1 issue\nhttps://sentry.sentry.io/issues/{group.id}/",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups

    def test_sentry_issue_url_multiple(self) -> None:
        """Test multiple issue URLs in one message"""
        group1 = self.create_group()
        group2 = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group1.organization.id,
            message=f"Fix multiple issues\n\n"
            f"https://sentry.io/organizations/test-org/issues/{group1.id}/\n"
            f"https://sentry.sentry.io/issues/{group2.id}/",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 2
        assert group1 in groups
        assert group2 in groups

    def test_sentry_issue_url_mixed_with_short_ids(self) -> None:
        """Test that URLs and short IDs can be mixed in the same message"""
        group1 = self.create_group()
        group2 = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group1.organization.id,
            message=f"Fix issues\n\n"
            f"Fixes {group1.qualified_short_id}\n"
            f"https://sentry.io/organizations/test-org/issues/{group2.id}/",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 2
        assert group1 in groups
        assert group2 in groups
