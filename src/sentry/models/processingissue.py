from __future__ import absolute_import

from hashlib import sha1
from django.db import models
from django.db.models.aggregates import Count
from django.utils import timezone

from sentry.db.models import BaseManager, Model, FlexibleForeignKey, GzippedDictField, sane_repr


def get_processing_issue_checksum(scope, object):
    h = sha1()
    h.update(scope.encode("utf-8") + b"\x00")
    h.update(object.encode("utf-8") + b"\x00")
    return h.hexdigest()


class ProcessingIssueManager(BaseManager):
    def with_num_events(self):
        return self.annotate(num_events=Count("eventprocessingissue"))

    def resolve_processing_issue(self, project, scope, object, type=None):
        """Resolves the given processing issues.  If not type is given
        all processing issues for scope and object are resolved regardless
        of the type.
        """
        checksum = get_processing_issue_checksum(scope, object)
        q = ProcessingIssue.objects.filter(project=project, checksum=checksum)
        if type is not None:
            q = q.filter(type=type)
        q.delete()

    def resolve_all_processing_issue(self, project):
        """
        Resolves all processing issues.
        """
        q = ProcessingIssue.objects.filter(project=project)
        q.delete()

    def discard_all_processing_issue(self, project):
        """
        Resolves all processing issues.
        """
        self.resolve_all_processing_issue(project)
        from sentry.models import RawEvent, ReprocessingReport

        RawEvent.objects.filter(project_id=project.id).delete()
        ReprocessingReport.objects.filter(project_id=project.id).delete()

    def find_resolved_queryset(self, project_ids):
        from sentry.models import RawEvent

        return RawEvent.objects.filter(
            project_id__in=project_ids, eventprocessingissue__isnull=True
        )

    def find_resolved(self, project_id, limit=100):
        """Returns a list of raw events that generally match the given
        processing issue and no longer have any issues remaining.  Returns
        a list of raw events that are now resolved and a bool that indicates
        if there are more.
        """
        from sentry import eventstore

        rv = list(self.find_resolved_queryset([project_id])[:limit])
        if len(rv) > limit:
            rv = rv[:limit]
            has_more = True
        else:
            has_more = False

        rv = list(rv)
        eventstore.bind_nodes(rv, "data")
        return rv, has_more

    def record_processing_issue(self, raw_event, scope, object, type, data=None):
        """Records a new processing issue for the given raw event."""
        data = dict(data or {})
        checksum = get_processing_issue_checksum(scope, object)
        data["_scope"] = scope
        data["_object"] = object
        issue, _ = ProcessingIssue.objects.get_or_create(
            project_id=raw_event.project_id, checksum=checksum, type=type, defaults=dict(data=data)
        )
        ProcessingIssue.objects.filter(pk=issue.id).update(datetime=timezone.now())
        # In case the issue moved away from unresolved we want to make
        # sure it's back to unresolved
        EventProcessingIssue.objects.get_or_create(raw_event=raw_event, processing_issue=issue)


class ProcessingIssue(Model):
    __core__ = False

    project = FlexibleForeignKey("sentry.Project", db_index=True)
    checksum = models.CharField(max_length=40, db_index=True)
    type = models.CharField(max_length=30)
    data = GzippedDictField()
    datetime = models.DateTimeField(default=timezone.now)

    objects = ProcessingIssueManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_processingissue"
        unique_together = (("project", "checksum", "type"),)

    __repr__ = sane_repr("project_id")

    @property
    def scope(self):
        return self.data["_scope"]

    @property
    def object(self):
        return self.data["_object"]


class EventProcessingIssue(Model):
    __core__ = False

    raw_event = FlexibleForeignKey("sentry.RawEvent")
    processing_issue = FlexibleForeignKey("sentry.ProcessingIssue")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_eventprocessingissue"
        unique_together = (("raw_event", "processing_issue"),)

    __repr__ = sane_repr("raw_event", "processing_issue")
