from datetime import timedelta
from unittest import mock

from django.utils import timezone

from sentry.buffer.base import Buffer
from sentry.models import Group, Organization, Project, Release, ReleaseProject, Team
from sentry.testutils import TestCase


class BufferTest(TestCase):
    def setUp(self):
        self.buf = Buffer()

    @mock.patch("sentry.buffer.base.process_incr")
    def test_incr_delays_task(self, process_incr):
        model = mock.Mock()
        columns = {"times_seen": 1}
        filters = {"id": 1}
        self.buf.incr(model, columns, filters)
        kwargs = dict(model=model, columns=columns, filters=filters, extra=None, signal_only=None)
        process_incr.apply_async.assert_called_once_with(kwargs=kwargs)

    def test_process_saves_data(self):
        group = Group.objects.create(project=Project(id=1))
        columns = {"times_seen": 1}
        filters = {"id": group.id, "project_id": 1}
        self.buf.process(Group, columns, filters)
        assert Group.objects.get(id=group.id).times_seen == group.times_seen + 1

    def test_process_saves_data_without_existing_row(self):
        columns = {"times_seen": 1}
        filters = {"message": "foo bar", "project_id": 1}
        self.buf.process(Group, columns, filters)
        group = Group.objects.get(message="foo bar")
        # the default value for times_seen is 1, so we actually end up
        # incrementing it to 2 here
        assert group.times_seen == 2
        assert group.project_id == 1

    def test_process_saves_extra(self):
        group = Group.objects.create(project=Project(id=1))
        columns = {"times_seen": 1}
        filters = {"id": group.id, "project_id": 1}
        the_date = timezone.now() + timedelta(days=5)
        self.buf.process(Group, columns, filters, {"last_seen": the_date})
        group_ = Group.objects.get(id=group.id)
        assert group_.times_seen == group.times_seen + 1
        assert group_.last_seen == the_date

    def test_increments_when_null(self):
        org = Organization.objects.create(slug="test-org")
        team = Team.objects.create(organization=org, slug="test-team")
        project = Project.objects.create(organization=org, slug="test-project")
        project.add_team(team)
        release = Release.objects.create(organization=org, version="abcdefg")
        release_project = ReleaseProject.objects.create(project=project, release=release)
        assert release_project.new_groups == 0

        columns = {"new_groups": 1}
        filters = {"id": release_project.id}
        self.buf.process(ReleaseProject, columns, filters)
        release_project_ = ReleaseProject.objects.get(id=release_project.id)
        assert release_project_.new_groups == 1

    @mock.patch("sentry.models.Group.objects.update_or_create")
    def test_signal_only(self, update_or_create):
        group = Group.objects.create(project=Project(id=1))
        columns = {"times_seen": 1}
        filters = {"id": group.id, "project_id": 1}
        the_date = timezone.now() + timedelta(days=5)
        prev_times_seen = group.times_seen
        self.buf.process(Group, columns, filters, {"last_seen": the_date}, signal_only=True)
        group.refresh_from_db()
        assert group.times_seen == prev_times_seen
