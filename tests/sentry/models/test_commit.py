from hashlib import sha1
from uuid import uuid4

from sentry.models.commit import Commit
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test


@region_silo_test
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
