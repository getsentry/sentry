import itertools
import uuid
from datetime import timedelta
from time import sleep
from unittest.mock import patch

import pytz

from sentry import eventstream
from sentry.issues.escalating import _generate_query, query_groups_past_counts
from sentry.models import Group, GroupStatus, UserReport
from sentry.similarity import _make_index_backend, features
from sentry.tasks.merge import merge_groups
from sentry.tasks.unmerge import get_fingerprint, unmerge
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.helpers.features import with_feature
from sentry.types.group import GroupSubStatus
from sentry.utils import redis

# Use the default redis client as a cluster client in the similarity index
index = _make_index_backend(redis.clusters.get("default").get_local_client(0))


@patch("sentry.similarity.features.index", new=index)
class UnmergeTestCase(TestCase, SnubaTestCase):
    def create_message_event(
        self,
        template,
        parameters,
        environment,
        release,
        project,
        now,
        sequence,
        tag_values,
        user_values,
        fingerprint="group1",
    ):

        i = next(sequence)

        event_id = uuid.UUID(fields=(i, 0x0, 0x1000, 0x80, 0x80, 0x808080808080)).hex

        tags = [["color", next(tag_values)]]

        if release:
            tags.append(["sentry:release", release])

        event = self.store_event(
            data={
                "event_id": event_id,
                "message": template % parameters,
                "type": "default",
                "user": next(user_values),
                "tags": tags,
                "fingerprint": [fingerprint],
                "timestamp": iso_format(now + timedelta(seconds=i)),
                "environment": environment,
                "release": release,
            },
            project_id=project.id,
        )

        UserReport.objects.create(
            project_id=project.id,
            group_id=event.group.id,
            event_id=event_id,
            name="Log Hat",
            email="ceo@corptron.com",
            comments="Quack",
        )

        features.record([event])

        return event

    @with_feature("organizations:escalating-issues-v2")
    def test_no_dest(self):
        now = before_now(minutes=5).replace(microsecond=0, tzinfo=pytz.utc)

        project = self.create_project()
        sequence = itertools.count(0)
        tag_values = itertools.cycle(["red", "green"])
        user_values = itertools.cycle([{"id": 1}, {"id": 2}])

        events = {}

        # Create 6 events for the child group now
        for event in (
            self.create_message_event(
                "This is message #%s!",
                i,
                environment="production",
                release="version",
                project=project,
                now=now,
                sequence=sequence,
                tag_values=tag_values,
                user_values=user_values,
            )
            for i in range(6)
        ):
            events.setdefault(get_fingerprint(event), []).append(event)

        # Create 10 events for the primary group now
        for event in (
            self.create_message_event(
                "This is message #%s.",
                i,
                environment="production",
                release="version2",
                project=project,
                now=now,
                tag_values=tag_values,
                user_values=user_values,
                sequence=sequence,
                fingerprint="group2",
            )
            for i in range(6, 16)
        ):
            events.setdefault(get_fingerprint(event), []).append(event)

        child, primary = list(Group.objects.all())
        primary.status = GroupStatus.IGNORED
        primary.substatus = GroupSubStatus.UNTIL_ESCALATING
        primary.save()

        # The following event counts should be true here:
        # get_group_hourly_count(primary) == 10
        # get_group_hourly_count(child) == 6
        # query_groups_past_counts should show the same counts

        # Merge primary and child
        with self.tasks():
            eventstream_state = eventstream.backend.start_merge(project.id, [child.id], primary.id)
            merge_groups.delay(
                [child.id],
                primary.id,
                eventstream_state=eventstream_state,
                handle_forecasts_ids=[primary.id, child.id],
                merge_forecasts=True,
            )

        sleep(1)
        # The following event counts should be true here:
        # get_group_hourly_count(primary) == 16
        # query_groups_past_counts should show the same count

        # Unmerge primary to create new_child
        with self.tasks():
            unmerge.delay(
                project_id=project.id,
                source_id=primary.id,
                destination_id=None,
                fingerprints=[list(events.keys())[0]],
                actor_id=None,
                batch_size=5,
            )
        sleep(1)
        # The event counts for primary should be 10; the event counts for new_child should be 6
        primary, new_child = list(Group.objects.all())

        print("="*40)

        # query events for groups x, y -> correctly returns 10, 6
        past = query_groups_past_counts(list(Group.objects.all()))

        # query events for just group x -> incorrectly returns 16 which is the count before unmerge
        primary_unmerge_past_count = query_groups_past_counts(
            [primary]
        )

        assert past[0]["count()"] == 10
        assert past[1]["count()"] == 6
        assert primary_unmerge_past_count[0]["count()"] == 10
