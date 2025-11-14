from typing import int
from datetime import timedelta

from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from sentry.deletions.base import BaseRelation, ModelDeletionTask, ModelRelation
from sentry.models.commit import Commit


class CommitDeletionTask(ModelDeletionTask[Commit]):
    def get_query_filter(self) -> Q:
        """
        Returns a Q object that filters for unused commits.
        Only targets commits that are:
        1. Not referenced by any ReleaseCommit (not part of any release)
        2. Not referenced by any ReleaseHeadCommit (not a head commit of any release)
        3. Not referenced by any GroupReaction (not reacted to by any group)
        4. Not referenced by any CommitComparison (not part of any comparison)
        5. Not referenced by any GroupCommitResolution (not resolving any group)
        6. Not referenced by any GroupLink (not linked to any group)
        7. Not referenced by any LatestRepoReleaseEnvironment.commit_id
        8. Older than 90 days
        """
        from sentry.models.commitcomparison import CommitComparison
        from sentry.models.groupcommitresolution import GroupCommitResolution
        from sentry.models.grouplink import GroupLink
        from sentry.models.groupreaction import GroupReaction
        from sentry.models.latestreporeleaseenvironment import LatestRepoReleaseEnvironment
        from sentry.models.releasecommit import ReleaseCommit
        from sentry.models.releaseheadcommit import ReleaseHeadCommit

        cutoff = timezone.now() - timedelta(days=90)

        releasecommit_exists = Exists(ReleaseCommit.objects.filter(commit_id=OuterRef("id")))
        releaseheadcommit_exists = Exists(
            ReleaseHeadCommit.objects.filter(commit_id=OuterRef("id"))
        )
        groupreaction_exists = Exists(GroupReaction.objects.filter(commit_id=OuterRef("id")))
        commitcomparison_head_exists = Exists(
            CommitComparison.objects.filter(head_commit_id=OuterRef("id"))
        )
        commitcomparison_base_exists = Exists(
            CommitComparison.objects.filter(base_commit_id=OuterRef("id"))
        )
        groupcommitresolution_exists = Exists(
            GroupCommitResolution.objects.filter(commit_id=OuterRef("id"))
        )
        grouplink_exists = Exists(
            GroupLink.objects.filter(
                project__organization_id=OuterRef("organization_id"),
                linked_id=OuterRef("id"),
                linked_type=GroupLink.LinkedType.commit,
            )
        )
        latestrepo_exists = Exists(
            LatestRepoReleaseEnvironment.objects.filter(commit_id=OuterRef("id"))
        )

        return Q(date_added__lt=cutoff) & ~Q(
            releasecommit_exists
            | releaseheadcommit_exists
            | groupreaction_exists
            | commitcomparison_head_exists
            | commitcomparison_base_exists
            | groupcommitresolution_exists
            | grouplink_exists
            | latestrepo_exists
        )

    def get_child_relations(self, instance: Commit) -> list[BaseRelation]:
        from sentry.models.commitfilechange import CommitFileChange
        from sentry.models.releasecommit import ReleaseCommit
        from sentry.models.releaseheadcommit import ReleaseHeadCommit

        return [
            ModelRelation(CommitFileChange, {"commit_id": instance.id}),
            ModelRelation(ReleaseCommit, {"commit_id": instance.id}),
            ModelRelation(ReleaseHeadCommit, {"commit_id": instance.id}),
        ]
