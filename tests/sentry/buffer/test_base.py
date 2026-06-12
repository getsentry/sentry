from datetime import timedelta
from unittest import mock

import psycopg2.errors
from django.db import DataError, IntegrityError
from django.utils import timezone

from sentry.buffer.base import Buffer, BufferField
from sentry.db.models.fields.bounded import BoundedPositiveIntegerField
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releases.release_project import ReleaseProject
from sentry.models.team import Team
from sentry.receivers import create_default_projects
from sentry.signals import buffer_incr_complete
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options


class BufferTest(TestCase):
    def setUp(self) -> None:
        create_default_projects()
        self.buf = Buffer()

    @mock.patch("sentry.buffer.base.process_incr")
    def test_incr_delays_task(self, process_incr: mock.MagicMock) -> None:
        model = Group
        columns = {"times_seen": 1}
        filters: dict[str, BufferField] = {"id": 1}
        self.buf.incr(model, columns, filters)
        kwargs = dict(
            model_name="sentry.group",
            columns=columns,
            filters=filters,
            extra=None,
            signal_only=None,
        )
        process_incr.apply_async.assert_called_once_with(kwargs=kwargs, headers=mock.ANY)

    def test_process_saves_data(self) -> None:
        group = Group.objects.create(project=Project(id=1))
        columns = {"times_seen": 1}
        filters = {"id": group.id, "project_id": 1}
        self.buf.process(Group, columns, filters)
        assert Group.objects.get(id=group.id).times_seen == group.times_seen + 1

    def test_process_saves_data_without_existing_row(self) -> None:
        columns = {"new_groups": 1}
        filters = {"project_id": self.project.id, "release_id": self.release.id}
        self.buf.process(ReleaseProject, columns, filters)
        assert ReleaseProject.objects.filter(new_groups=1, **filters).exists()

    def test_process_saves_extra(self) -> None:
        group = Group.objects.create(project=Project(id=1))
        columns = {"times_seen": 1}
        filters = {"id": group.id, "project_id": 1}
        the_date = timezone.now() + timedelta(days=5)
        self.buf.process(Group, columns, filters, {"last_seen": the_date})
        reload = Group.objects.get(id=group.id)
        assert reload.times_seen == group.times_seen + 1
        assert reload.last_seen == the_date

    def test_increments_when_null(self) -> None:
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

    def test_signal_only(self) -> None:
        group = Group.objects.create(project=Project(id=1))
        columns = {"times_seen": 1}
        filters = {"id": group.id, "project_id": 1}
        the_date = timezone.now() + timedelta(days=5)
        prev_times_seen = group.times_seen
        self.buf.process(Group, columns, filters, {"last_seen": the_date}, signal_only=True)
        group.refresh_from_db()
        assert group.times_seen == prev_times_seen

    @override_options({"buffer.update-or-create.rollout": 1.0})
    def test_process_non_group_update_increments_column(self) -> None:
        """Buffer.process() increments a column on an existing non-Group row via F() expression."""
        # self.release already has a ReleaseProject for self.project (created by add_project)
        rp = ReleaseProject.objects.get(project=self.project, release=self.release)
        ReleaseProject.objects.filter(id=rp.id).update(new_groups=5)

        received: list[bool] = []

        def on_signal(sender, created, **kw):
            received.append(created)

        buffer_incr_complete.connect(on_signal, weak=False)
        try:
            self.buf.process(
                ReleaseProject,
                {"new_groups": 3},
                {"project_id": self.project.id, "release_id": self.release.id},
            )
        finally:
            buffer_incr_complete.disconnect(on_signal)

        rp.refresh_from_db()
        assert rp.new_groups == 8
        assert received == [False]

    @override_options({"buffer.update-or-create.rollout": 1.0})
    def test_process_non_group_create_sets_initial_value(self) -> None:
        """Buffer.process() creates a row with the column's raw initial value when it doesn't exist."""
        # Create a release that has no ReleaseProject yet
        new_release = Release.objects.create(
            version="buffer-test-v1", organization_id=self.project.organization_id
        )
        received: list[bool] = []

        def on_signal(sender, created, **kw):
            received.append(created)

        buffer_incr_complete.connect(on_signal, weak=False)
        try:
            self.buf.process(
                ReleaseProject,
                {"new_groups": 4},
                {"project_id": self.project.id, "release_id": new_release.id},
            )
        finally:
            buffer_incr_complete.disconnect(on_signal)

        rp = ReleaseProject.objects.get(project=self.project, release=new_release)
        assert rp.new_groups == 4
        assert received == [True]

    @override_options({"buffer.update-or-create.rollout": 1.0})
    def test_process_race_condition_integrity_error_handled(self) -> None:
        """IntegrityError during create (concurrent insert race) is caught and retried as update."""
        # Create a release that has no ReleaseProject so filter().update() returns 0
        new_release = Release.objects.create(
            version="buffer-test-race", organization_id=self.project.organization_id
        )
        columns = {"new_groups": 2}
        filters = {"project_id": self.project.id, "release_id": new_release.id}

        # No row exists → filter().update() returns 0 → triggers create path.
        # Mock create to raise IntegrityError (simulating a concurrent insert winning the race).
        # The code must catch it and retry with filter().update() — without propagating.
        with mock.patch.object(
            ReleaseProject.objects, "create", side_effect=IntegrityError("duplicate key")
        ):
            self.buf.process(ReleaseProject, columns, filters)

    def test_process_caps_times_seen_on_overflow(self) -> None:
        """Test that times_seen is capped to BoundedPositiveIntegerField.MAX_VALUE when increment would cause overflow.

        Note: We use mocking here because triggering a real NumericValueOutOfRange
        inside a test transaction causes PostgreSQL to abort the transaction,
        preventing the retry from succeeding. In production, buffer processing
        runs outside transactions, so the retry works correctly.
        """
        group = Group.objects.create(project=Project(id=1))
        columns = {"times_seen": 1}
        filters = {"id": group.id, "project_id": 1}

        # First call raises overflow error, second call succeeds
        cause = psycopg2.errors.NumericValueOutOfRange()
        error = DataError("integer out of range")
        error.__cause__ = cause
        mock_update = mock.MagicMock(side_effect=[error, None])

        with mock.patch.object(Group, "update", mock_update):
            self.buf.process(Group, columns, filters)

        # Verify it retried (called twice)
        assert mock_update.call_count == 2

        # Verify the second call had times_seen capped to BoundedPositiveIntegerField.MAX_VALUE
        second_call_kwargs = mock_update.call_args_list[1][1]
        assert second_call_kwargs["times_seen"] == BoundedPositiveIntegerField.MAX_VALUE

    def test_process_skips_times_seen_increment_when_already_max(self) -> None:
        """Test that we skip times_seen increment but still update other fields when at BoundedPositiveIntegerField.MAX_VALUE."""
        group = Group.objects.create(project=Project(id=1))
        Group.objects.filter(id=group.id).update(times_seen=BoundedPositiveIntegerField.MAX_VALUE)
        columns = {"times_seen": 1}
        filters = {"id": group.id, "project_id": 1}
        the_date = timezone.now() + timedelta(days=5)

        mock_update = mock.MagicMock()

        with mock.patch.object(Group, "update", mock_update):
            self.buf.process(Group, columns, filters, {"last_seen": the_date})

        # Verify update was called once with last_seen but without times_seen
        assert mock_update.call_count == 1
        call_kwargs = mock_update.call_args[1]
        assert "times_seen" not in call_kwargs
        assert call_kwargs["last_seen"] == the_date
