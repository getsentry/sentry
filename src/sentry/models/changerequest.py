from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone

from sentry.db.models import (BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr)
from sentry.utils.grouprefence import find_referenced_groups


class ChangeRequest(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    repository_id = BoundedPositiveIntegerField()

    key = models.CharField(max_length=64)  # example, 5131 on github

    date_added = models.DateTimeField(default=timezone.now)

    commits = models.ManyToManyField('sentry.Commit')
    title = models.TextField(null=True)
    message = models.TextField(null=True)
    author = FlexibleForeignKey('sentry.CommitAuthor', null=True)
    synced_commits = models.BooleanField(default=False)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_change_request'
        index_together = (('repository_id', 'date_added'), )
        unique_together = (('repository_id', 'key'), )

    __repr__ = sane_repr('organization_id', 'repository_id', 'key')

    def find_referenced_groups(self):
        text = u'{} {}'.format(self.message, self.title)
        return find_referenced_groups(text, self.organization_id)

    def set_commits(self, commit_list):
        """
        Bind a list of commits to this PR.

        This will clear any existing commit log and replace it with the given
        commits.
        """
        from sentry.models import Commit
        from sentry.plugins.providers.repository import RepositoryProvider

        commit_list = [
            c for c in commit_list
            if not RepositoryProvider.should_ignore_commit(c.get('message', ''))
        ]

        self.save()
        self.commits.clear()

        commits = Commit.objects.filter(
            key__in=[c['sha'] for c in commit_list]
        )

        self.commits.add(*commits)

    def fetch_commits(self, user):
        from sentry.tasks.commits import fetch_pr_commits

        if not self.synced_commits:

            fetch_pr_commits.apply_async(
                kwargs={
                    'user_id': user.id,
                    'change_id': self.change_id,
                }
            )

            self.update(
                synced_commits=True
            )
