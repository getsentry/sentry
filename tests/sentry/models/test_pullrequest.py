from hashlib import sha1
from uuid import uuid4

from sentry.models.commit import Commit
from sentry.models.group import GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase


class FindReferencedGroupsTest(TestCase):
    def test_multiple_matches_basic(self) -> None:
        group = self.create_group()
        group2 = self.create_group()

        repo = Repository.objects.create(name="example", organization_id=group.organization.id)

        commit = Commit.objects.create(
            key=sha1(uuid4().hex.encode("utf-8")).hexdigest(),
            repository_id=repo.id,
            organization_id=group.organization.id,
            # It makes reference to the first group
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
        )

        groups = commit.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups
        assert GroupHistory.objects.filter(
            group=group,
            status=GroupHistoryStatus.SET_RESOLVED_IN_COMMIT,
        ).exists()
        # XXX: At what point does the issue get marked as resolved?
        assert group.status == GroupStatus.UNRESOLVED

        pr = PullRequest.objects.create(
            key="1",
            repository_id=repo.id,
            organization_id=group.organization.id,
            title="very cool PR to fix the thing",
            # It makes reference to the second group
            message=f"Foo Biz\n\nFixes {group2.qualified_short_id}",
        )

        groups = pr.find_referenced_groups()
        assert len(groups) == 1
        assert group2 in groups
        assert GroupHistory.objects.filter(
            group=group2,
            status=GroupHistoryStatus.SET_RESOLVED_IN_PULL_REQUEST,
        ).exists()
        # XXX: At what point does the issue get marked as resolved?
        assert group.status == GroupStatus.UNRESOLVED
