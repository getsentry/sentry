from hashlib import sha1
from typing import ClassVar

from django.db import models
from django.db.models.aggregates import Count
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BaseManager,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.models.release import Release


def get_processing_issue_checksum(scope, object):
    h = sha1()
    h.update(scope.encode("utf-8") + b"\x00")
    h.update(object.encode("utf-8") + b"\x00")
    return h.hexdigest()


class ProcessingIssueManager(BaseManager["ProcessingIssue"]):
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
        from sentry.models.rawevent import RawEvent
        from sentry.models.reprocessingreport import ReprocessingReport

        RawEvent.objects.filter(project_id=project.id).delete()
        ReprocessingReport.objects.filter(project_id=project.id).delete()

    def find_resolved_queryset(self, project_ids):
        from sentry.models.rawevent import RawEvent

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
        eventstore.backend.bind_nodes(rv, "data")
        return rv, has_more

    def record_processing_issue(self, raw_event, scope, object, type, data=None):
        """Records a new processing issue for the given raw event."""
        checksum = get_processing_issue_checksum(scope, object)

        release = raw_event.data.get("release")
        dist = raw_event.data.get("dist")

        data = dict(data or {})
        data["_scope"] = scope
        data["_object"] = object
        if release:
            data["release"] = release
            if dist:
                data["dist"] = dist

        issue, created = ProcessingIssue.objects.get_or_create(
            project_id=raw_event.project_id, checksum=checksum, type=type, defaults=dict(data=data)
        )

        if not created:
            prev_release = issue.data.get("release")
            if Release.is_release_newer_or_equal(
                raw_event.project.organization.id, release, prev_release
            ):
                issue.data["release"] = release
                # In case we have a dist, we want to remove it, since we are changing release. Then in the next step
                # we might either add the dist or not.
                # This code is put to avoid the edge case in which a newer release comes without a dist and a previous
                # dist existed.
                if "dist" in issue.data:
                    issue.data.pop("dist")
                if dist:
                    issue.data["dist"] = dist

        issue.datetime = timezone.now()
        issue.save()

        # In case the issue moved away from unresolved we want to make
        # sure it's back to unresolved
        EventProcessingIssue.objects.get_or_create(raw_event=raw_event, processing_issue=issue)


@region_silo_only_model
class ProcessingIssue(Model):
    __relocation_scope__ = RelocationScope.Excluded

    project = FlexibleForeignKey("sentry.Project", db_index=True)
    checksum = models.CharField(max_length=40, db_index=True)
    type = models.CharField(max_length=30)
    data = GzippedDictField()
    datetime = models.DateTimeField(default=timezone.now)

    objects: ClassVar[ProcessingIssueManager] = ProcessingIssueManager()

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


@region_silo_only_model
class EventProcessingIssue(Model):
    __relocation_scope__ = RelocationScope.Excluded

    raw_event = FlexibleForeignKey("sentry.RawEvent")
    processing_issue = FlexibleForeignKey("sentry.ProcessingIssue")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_eventprocessingissue"
        unique_together = (("raw_event", "processing_issue"),)

    __repr__ = sane_repr("raw_event", "processing_issue")
