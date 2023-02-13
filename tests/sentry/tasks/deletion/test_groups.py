from uuid import uuid4

from sentry import nodestore
from sentry.eventstore.models import Event
from sentry.models import Group, GroupAssignee, GroupHash, GroupMeta, GroupRedirect, GroupStatus
from sentry.tasks.deletion import delete_groups
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class DeleteGroupTest(TestCase):
    def test_simple(self):
        event_id = "a" * 32
        event_id_2 = "b" * 32
        project = self.create_project()

        node_id = Event.generate_node_id(project.id, event_id)
        node_id_2 = Event.generate_node_id(project.id, event_id_2)

        event = self.store_event(
            data={
                "event_id": event_id,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group1"],
            },
            project_id=project.id,
        )

        self.store_event(
            data={
                "event_id": event_id_2,
                "timestamp": iso_format(before_now(minutes=1)),
                "fingerprint": ["group1"],
            },
            project_id=project.id,
        )

        group = event.group
        group.update(status=GroupStatus.PENDING_DELETION)

        GroupAssignee.objects.create(group=group, project=project, user_id=self.user.id)
        GroupHash.objects.create(project=project, group=group, hash=uuid4().hex)
        GroupMeta.objects.create(group=group, key="foo", value="bar")
        GroupRedirect.objects.create(group_id=group.id, previous_group_id=1)

        assert nodestore.get(node_id)
        assert nodestore.get(node_id_2)

        with self.tasks():
            delete_groups(object_ids=[group.id])

        assert not GroupRedirect.objects.filter(group_id=group.id).exists()
        assert not GroupHash.objects.filter(group_id=group.id).exists()
        assert not Group.objects.filter(id=group.id).exists()
        assert not nodestore.get(node_id)
        assert not nodestore.get(node_id_2)
