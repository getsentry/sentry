# -*- coding: utf-8 -*-
#
# TODO: make into real script
from contextlib import contextmanager
from south.db import db
from south.v2 import DataMigration
from django.db import transaction
from sentry.utils.strings import iter_callsign_choices


class RollbackLocally(Exception):
    pass


@contextmanager
def catchable_atomic():
    try:
        with transaction.atomic():
            yield
    except RollbackLocally:
        pass


def get_callsigns(projects):
    rv = {}

    for project in projects:
        if project.callsign is not None:
            rv[project.callsign] = project.id
            continue
        for callsign in iter_callsign_choices(project.name):
            if callsign in rv:
                continue
            rv[callsign] = project.id
            break

    return dict((v, k) for k, v in rv.iteritems())


class Migration(DataMigration):

    def forwards(self, orm):
        from sentry.utils.query import RangeQuerySetWrapperWithProgressBar, \
            RangeQuerySetWrapper
        from sentry.models.counter import increment_project_counter

        db.commit_transaction()

        Organization = orm['sentry.Organization']
        Group = orm['sentry.Group']
        Project = orm['sentry.Project']
        ProjectOption = orm['sentry.ProjectOption']

        queryset = Organization.objects.all()

        for org in RangeQuerySetWrapperWithProgressBar(queryset):
            projects = list(org.project_set.all())
            callsigns = get_callsigns(projects)
            for project in projects:
                if project.callsign is None:
                    Project.objects.filter(
                        pk=project.id,
                        callsign=None
                    ).update(callsign=callsigns[project.id])
                    ProjectOption.objects.filter(
                        project=project,
                        key='sentry:reviewed-callsign'
                    ).delete()
                q = Group.objects.filter(
                    project=project,
                    short_id=None,
                )
                for group in RangeQuerySetWrapper(q):
                    with catchable_atomic():
                        pending_short_id = increment_project_counter(
                            project)
                        updated = Group.objects.filter(
                            pk=group.id,
                            short_id=None
                        ).update(short_id=pending_short_id)
                        if updated == 0:
                            raise RollbackLocally()

        db.start_transaction()

    def backwards(self, orm):
        from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

        Organization = orm['sentry.Organization']
        Group = orm['sentry.Group']
        Project = orm['sentry.Project']
        ProjectOption = orm['sentry.ProjectOption']

        queryset = Organization.objects.all()

        for org in RangeQuerySetWrapperWithProgressBar(queryset):
            project_ids = [x['id'] for x in org.project_set.values('id')]
            Project.objects.filter(
                organization=org
            ).update(callsign=None)
            ProjectOption.objects.filter(
                project__in=project_ids,
                key='sentry:reviewed-callsign'
            ).delete()
            Group.objects.filter(
                project_id__in=project_ids
            ).update(short_id=None)
