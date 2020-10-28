from __future__ import absolute_import, print_function

from django.db import models
from django.db.models.signals import post_save
from django.utils import timezone

from sentry.db.models import BoundedPositiveIntegerField, FlexibleForeignKey, Model, sane_repr
from sentry.utils.groupreference import find_referenced_groups


class PullRequest(Model):
    __core__ = False

    organization_id = BoundedPositiveIntegerField(db_index=True)
    repository_id = BoundedPositiveIntegerField()

    key = models.CharField(max_length=64)  # example, 5131 on github

    date_added = models.DateTimeField(default=timezone.now)

    title = models.TextField(null=True)
    message = models.TextField(null=True)
    author = FlexibleForeignKey("sentry.CommitAuthor", null=True)
    merge_commit_sha = models.CharField(max_length=64, null=True)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pull_request"
        index_together = (("repository_id", "date_added"), ("organization_id", "merge_commit_sha"))
        unique_together = (("repository_id", "key"),)

    __repr__ = sane_repr("organization_id", "repository_id", "key")

    def find_referenced_groups(self):
        text = u"{} {}".format(self.message, self.title)
        return find_referenced_groups(text, self.organization_id)

    @classmethod
    def create_or_save(cls, organization_id, repository_id, key, values):
        """
        Wraps create_or_update and ensures post_save signals are fired
        for updated records as GroupLink functionality is dependent
        on signals being fired.
        """
        affected, created = cls.objects.create_or_update(
            organization_id=organization_id, repository_id=repository_id, key=key, values=values
        )
        if created is False:
            instance = cls.objects.get(
                organization_id=organization_id, repository_id=repository_id, key=key
            )
            post_save.send(sender=cls, instance=instance, created=created)
        return affected, created


class PullRequestCommit(Model):
    __core__ = False
    pull_request = FlexibleForeignKey("sentry.PullRequest")
    commit = FlexibleForeignKey("sentry.Commit")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_pullrequest_commit"
        unique_together = (("pull_request", "commit"),)
