from __future__ import absolute_import, print_function

from django.db import models
from django.utils import timezone
from collections import defaultdict

from sentry.db.models import BoundedBigIntegerField, Model, sane_repr


class PlatformExternalIssue(Model):
    __core__ = False

    group_id = BoundedBigIntegerField()
    # external service that's linked to the sentry issue
    service_type = models.CharField(max_length=64)
    display_name = models.TextField()
    web_url = models.URLField()
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_platformexternalissue"
        unique_together = (("group_id", "service_type"),)

    __repr__ = sane_repr("group_id", "service_type", "display_name", "web_url")

    @classmethod
    def get_annotations_for_group_list(cls, group_list):
        external_issues = cls.objects.filter(group_id__in=[group.id for group in group_list])

        # group annotations by group id
        annotations_by_group_id = defaultdict(list)
        for ei in external_issues:
            annotation = '<a href="%s">%s</a>' % (ei.web_url, ei.display_name)
            annotations_by_group_id[ei.group_id].append(annotation)

        return annotations_by_group_id
