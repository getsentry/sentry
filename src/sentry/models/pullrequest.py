from __future__ import absolute_import, print_function

from django.db import models, transaction
from django.utils import timezone

from sentry.db.models import (BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr)
from sentry.utils.groupreference import find_referenced_groups


class PullRequest(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    repository_id = BoundedPositiveIntegerField()

    key = models.CharField(max_length=64)  # example, 5131 on github

    date_added = models.DateTimeField(default=timezone.now)

    title = models.TextField(null=True)
    message = models.TextField(null=True)
    author = FlexibleForeignKey('sentry.CommitAuthor', null=True)
    merge_commit_sha = models.CharField(max_length=64, null=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_pull_request'
        index_together = (('repository_id', 'date_added'), )
        unique_together = (('repository_id', 'key'), )

    __repr__ = sane_repr('organization_id', 'repository_id', 'key')

    def find_referenced_groups(self):
        text = u'{} {}'.format(self.message, self.title)
        return find_referenced_groups(text, self.organization_id)

    def set_commits(self, commit_list):
        with transaction.atomic():
            PullRequestCommit.objects.filter(
                pull_request=self,
            ).exclude(
                commit__in=commit_list,
            ).delete()
            existing = set(PullRequestCommit.objects.filter(
                pull_request=self,
            ).values_list('commit', flat=True))
            commits_missing = [c for c in commit_list if c.id not in existing]
            for commit in commits_missing:
                PullRequestCommit.objects.create(
                    pull_request=self,
                    commit=commit,
                )


class PullRequestCommit(Model):
    __core__ = False

    pull_request = FlexibleForeignKey('sentry.PullRequest')
    commit = FlexibleForeignKey('sentry.Commit')

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_pullrequest_commit'
        unique_together = (('pull_request', 'commit'), )
