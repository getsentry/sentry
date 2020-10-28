from __future__ import absolute_import

from hashlib import sha1
from uuid import uuid4

from sentry.models import Commit, Repository, PullRequest
from sentry.testutils import TestCase


class FindReferencedGroupsTest(TestCase):
    def test_multiple_matches_basic(self):
        group = self.create_group()
        group2 = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=self.group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            message=u"Foo Biz\n\nFixes {}".format(group.qualified_short_id),
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups

        pr = PullRequest.objects.create(
            key="1",
            repository_id=repo.id,
            organization_id=group.organization.id,
            title="very cool PR to fix the thing",
            message=u"Foo Biz\n\nFixes {}".format(group2.qualified_short_id),
        )

        groups = pr.find_referenced_groups()
        assert len(groups) == 1
        assert group2 in groups
