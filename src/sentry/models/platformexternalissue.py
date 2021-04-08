from collections import defaultdict

from django.db import models
from django.utils import timezone

from sentry.db.models import Model, sane_repr
from sentry.db.models.fields.foreignkey import FlexibleForeignKey


class PlatformExternalIssue(Model):
    __core__ = False

    group = FlexibleForeignKey("sentry.Group", db_constraint=False, db_index=False)
    project = FlexibleForeignKey("sentry.Project", null=True, db_constraint=False)

    # external service that's linked to the sentry issue
    service_type = models.CharField(max_length=64)
    display_name = models.TextField()
    web_url = models.URLField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_platformexternalissue"
        unique_together = (("group", "service_type"),)

    __repr__ = sane_repr("group_id", "service_type", "display_name", "web_url")

    @classmethod
    def get_annotations_for_group_list(cls, group_list):
        external_issues = cls.objects.filter(group_id__in=[group.id for group in group_list])

        # group annotations by group id
        annotations_by_group_id = defaultdict(list)
        for ei in external_issues:
            annotation = f'<a href="{ei.web_url}">{ei.display_name}</a>'
            annotations_by_group_id[ei.group_id].append(annotation)

        return annotations_by_group_id
