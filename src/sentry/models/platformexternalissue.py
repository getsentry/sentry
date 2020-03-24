from __future__ import absolute_import, print_function

import six
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
    def get_annotations(cls, group):
        external_issues = cls.objects.filter(group_id=group.id)
        return cls.map_external_issues_to_annotations(external_issues)

    @classmethod
    def map_external_issues_to_annotations(cls, external_issues):
        annotations = []
        for ei in external_issues:
            annotations.append('<a href="%s">%s</a>' % (ei.web_url, ei.display_name))

        return annotations

    @classmethod
    def get_annotations_for_group_list(cls, group_list):
        group_id_list = [group.id for group in group_list]
        external_issues = cls.objects.filter(group_id__in=group_id_list)

        # group the external_ids by the group id
        external_issues_by_group_id = defaultdict(list)
        for external_issue in external_issues:
            external_issues_by_group_id[external_issue.group_id].append(external_issue)

        # group annotations by group id
        annotations_by_group_id = {}
        for group_id, external_issues in six.iteritems(external_issues_by_group_id):
            annotations_by_group_id[group_id] = cls.map_external_issues_to_annotations(
                external_issues
            )

        return annotations_by_group_id
