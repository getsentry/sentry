from hashlib import sha1
from uuid import uuid4

from sentry.models.commit import Commit
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase


class FindReferencedGroupsTest(TestCase):
    def test_multiple_matches_basic(self):
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

    def test_multiple_matches_comma_separated(self):
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

    def test_markdown_links(self):
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

    def test_sentry_url_resolution(self):
        group = self.create_group()
        group2 = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        # Test single URL resolution
        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes https://sentry.io/issues/{group.id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups

        # Test multiple URL resolution
        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes https://sentry.io/issues/{group.id} https://sentry.io/issues/{group2.id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 2
        assert group in groups
        assert group2 in groups

        # Test mixed URL and short ID resolution
        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes https://sentry.io/issues/{group.id} {group2.qualified_short_id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 2
        assert group in groups
        assert group2 in groups

        # Test HTTPS URL resolution
        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nResolves https://hyreas.sentry.io/issues/{group.id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups

        # Test different .io subdomain
        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes https://mycompany.sentry.io/issues/{group.id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups

    def test_sentry_url_validation(self):
        """Test that only Sentry-like URLs are processed"""
        group = self.create_group()
        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        # Test that random URLs are ignored
        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes https://github.com/issues/{group.id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 0

        # Test that only .io Sentry URLs are processed
        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes https://hyreas.sentry.io/issues/{group.id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups

        # Test that .com URLs are ignored (not hosted Sentry)
        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=f"Foo Biz\n\nFixes https://sentry.company.com/issues/{group.id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 0
