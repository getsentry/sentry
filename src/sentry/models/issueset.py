from django.db import models

from sentry.db.models import BaseManager, FlexibleForeignKey, Model, sane_repr
from sentry.models.issuesetitem import IssueSetItem


class IssueSetManager(BaseManager):
    def add_issues(self, organization_id, issue_set_id, issue_list):
        issue_set = self.get(organization_id=organization_id, id=issue_set_id)
        for issue in issue_list:
            IssueSetItem.objects.get_or_create(
                issue_set_id=issue_set.id, group_id=issue.id, project_id=issue.project_id
            )


class IssueSet(Model):
    name = models.CharField(max_length=128)
    organization = FlexibleForeignKey("sentry.Organization", null=True)
    items = models.ManyToManyField("sentry.Group", blank=True, through="sentry.IssueSetItem")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_issueset"

    __include_in_export__ = False
    __repr__ = sane_repr("name", "organization_id")
    objects = IssueSetManager()
