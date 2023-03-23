from hashlib import sha1

from django.db import models
from django.db.models.aggregates import Count
from django.utils import timezone

from sentry.db.models import (
    BaseManager,
    FlexibleForeignKey,
    GzippedDictField,
    Model,
    region_silo_only_model,
    sane_repr,
)
from sentry.models import Release


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

    @staticmethod
    def is_release_newer(project_id, release, other_release):
        if other_release is None:
            return True

        try:
            # TODO: we would need the organization to efficiently query the release.
            release = Release.objects.get(projects__id=project_id, version=release)
            other_release = Release.objects.get(projects__id=project_id, version=other_release)

            return float(release.date_added.timestamp()) > float(
                other_release.date_added.timestamp()
            )
        except Release.DoesNotExist:
            return False

    def record_processing_issue(self, raw_event, scope, object, type, data=None):
        """Records a new processing issue for the given raw event."""
        checksum = get_processing_issue_checksum(scope, object)

        data = dict(data or {})
        data["_scope"] = scope
        data["_object"] = object

        issue, created = ProcessingIssue.objects.get_or_create(
            project_id=raw_event.project_id, checksum=checksum, type=type, defaults=dict(data=data)
        )

        issue.datetime = timezone.now()

        release = raw_event.data.get("release")
        dist = raw_event.data.get("dist")

        def update_issue(is_valid_release):
            if is_valid_release():
                issue.data["release"] = release

                if dist is not None:
                    issue.data["dist"] = dist

        if created:
            update_issue(lambda: release is not None)
        else:
            prev_release = issue.data.get("release")
            update_issue(
                lambda: release is not None
                and self.is_release_newer(raw_event.project_id, release, prev_release)
            )

        # We want to save the updated data.
        issue.save()

        # In case the issue moved away from unresolved we want to make
        # sure it's back to unresolved
        EventProcessingIssue.objects.get_or_create(raw_event=raw_event, processing_issue=issue)


@region_silo_only_model
class ProcessingIssue(Model):
    __include_in_export__ = False

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


@region_silo_only_model
class EventProcessingIssue(Model):
    __include_in_export__ = False

    raw_event = FlexibleForeignKey("sentry.RawEvent")
    processing_issue = FlexibleForeignKey("sentry.ProcessingIssue")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_eventprocessingissue"
        unique_together = (("raw_event", "processing_issue"),)

    __repr__ = sane_repr("raw_event", "processing_issue")
