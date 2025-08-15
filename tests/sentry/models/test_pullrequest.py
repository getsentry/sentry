from hashlib import sha1
from uuid import uuid4

from sentry.models.commit import Commit
from sentry.models.group import GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.grouplink import GroupLink
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.testutils.cases import TestCase


class FindReferencedGroupsTest(TestCase):
    def test_resolve_in_commit(self) -> None:
        group = self.create_group()

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
        # These are created in resolved_in_commit
        assert GroupHistory.objects.filter(
            group=group,
            status=GroupHistoryStatus.SET_RESOLVED_IN_COMMIT,
        ).exists()
        assert GroupLink.objects.filter(
            group=group,
            linked_type=GroupLink.LinkedType.commit,
            linked_id=commit.id,
        ).exists()
        group.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED

    def test_resolve_in_pull_request(self) -> None:
        group = self.create_group()
        repo = Repository.objects.create(name="example", organization_id=group.organization.id)

        pr = PullRequest.objects.create(
            key="1",
            repository_id=repo.id,
            organization_id=group.organization.id,
            title="very cool PR to fix the thing",
            # It makes reference to the second group
            message=f"Foo Biz\n\nFixes {group.qualified_short_id}",
        )

        groups = pr.find_referenced_groups()
        assert len(groups) == 1
        assert group in groups
        # These are created in resolved_in_pull_request
        assert GroupHistory.objects.filter(
            group=group,
            status=GroupHistoryStatus.SET_RESOLVED_IN_PULL_REQUEST,
        ).exists()
        assert GroupLink.objects.filter(
            group=group,
            linked_type=GroupLink.LinkedType.pull_request,
            linked_id=pr.id,
        ).exists()
        # XXX: Oddly,resolved_in_pull_request doesn't update the group status
        group.refresh_from_db()
        assert group.status == GroupStatus.UNRESOLVED
