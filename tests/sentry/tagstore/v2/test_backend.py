from __future__ import absolute_import

import pytest

from collections import OrderedDict
from datetime import datetime, timedelta

from django.utils import timezone

from sentry.search.base import ANY
from sentry.testutils import TestCase
from sentry.tagstore import TagKeyStatus
from sentry.tagstore.v2.backend import V2TagStorage
from sentry.tagstore.v2.models import TagKey, TagValue, GroupTagKey, GroupTagValue, EventTag
from sentry.tagstore.exceptions import TagKeyNotFound, TagValueNotFound, GroupTagKeyNotFound, GroupTagValueNotFound


class TagStorage(TestCase):
    def setUp(self):
        self.ts = V2TagStorage()

        self.proj1 = self.create_project()
        self.proj1group1 = self.create_group(self.proj1)
        self.proj1group2 = self.create_group(self.proj1)
        self.proj1env1 = self.create_environment(project=self.proj1)
        self.proj1env2 = self.create_environment(project=self.proj1)
        self.proj1group1event1 = self.create_event(project=self.proj1, group=self.proj1group1)
        self.proj1group1event2 = self.create_event(project=self.proj1, group=self.proj1group1)
        self.proj1group1event3 = self.create_event(project=self.proj1, group=self.proj1group1)

        self.proj2 = self.create_project()
        self.proj2group1 = self.create_group(self.proj2)
        self.proj2env1 = self.create_environment(project=self.proj2)

        self.key1 = 'key1'
        self.value1 = 'value1'

    def test_create_tag_key(self):
        with pytest.raises(TagKeyNotFound):
            self.ts.get_tag_key(
                project_id=self.proj1.id,
                environment_id=self.proj1env1.id,
                key=self.key1,
            )

        assert self.ts.get_tag_keys(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
        ) == []

        tk = self.ts.create_tag_key(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        assert self.ts.get_tag_key(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        ).id == tk.id

        assert self.ts.get_tag_keys(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
        ) == [tk]

        assert TagKey.objects.all().count() == 1

    def test_get_or_create_tag_key(self):
        tk1, _ = self.ts.get_or_create_tag_key(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        tk2, _ = self.ts.get_or_create_tag_key(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        assert tk1.id == tk2.id
        assert TagKey.objects.filter(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        ).count() == 1
        assert TagKey.objects.all().count() == 1

    def test_create_tag_value(self):
        with pytest.raises(TagValueNotFound):
            self.ts.get_tag_value(
                project_id=self.proj1.id,
                environment_id=self.proj1env1.id,
                key=self.key1,
                value=self.value1,
            )

        assert self.ts.get_tag_values(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        ) == []

        tv = self.ts.create_tag_value(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        )

        assert self.ts.get_tag_values(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        ) == [tv]

        assert self.ts.get_tag_value(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        ).id == tv.id
        assert TagKey.objects.all().count() == 1
        assert TagValue.objects.all().count() == 1

    def test_get_or_create_tag_value(self):
        tv1, _ = self.ts.get_or_create_tag_value(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        )

        tv2, _ = self.ts.get_or_create_tag_value(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        )

        assert tv1.id == tv2.id

        tk = TagKey.objects.get(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        assert TagKey.objects.all().count() == 1

        assert TagValue.objects.filter(
            project_id=self.proj1.id,
            _key__environment_id=self.proj1env1.id,
            _key_id=tk.id,
            value=self.value1,
        ).count() == 1
        assert TagValue.objects.all().count() == 1

    def test_create_group_tag_key(self):
        with pytest.raises(GroupTagKeyNotFound):
            self.ts.get_group_tag_key(
                project_id=self.proj1.id,
                group_id=self.proj1group1.id,
                environment_id=self.proj1env1.id,
                key=self.key1,
            )

        assert self.ts.get_group_tag_keys(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
        ) == []

        gtk = self.ts.create_group_tag_key(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        self.ts.get_group_tag_keys(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
        ) == [gtk]

        TagKey.objects.get(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )
        assert TagKey.objects.all().count() == 1

        assert self.ts.get_group_tag_key(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        ).id == gtk.id
        assert GroupTagKey.objects.all().count() == 1

    def test_get_or_create_group_tag_key(self):
        gtk1, _ = self.ts.get_or_create_group_tag_key(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        gtk2, _ = self.ts.get_or_create_group_tag_key(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        assert gtk1.id == gtk2.id

        tk = TagKey.objects.get(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )
        assert TagKey.objects.all().count() == 1

        assert GroupTagKey.objects.filter(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            _key__environment_id=self.proj1env1.id,
            _key_id=tk.id,
        ).count() == 1
        assert GroupTagKey.objects.all().count() == 1

    def test_create_group_tag_value(self):
        with pytest.raises(GroupTagValueNotFound):
            self.ts.get_group_tag_value(
                project_id=self.proj1.id,
                group_id=self.proj1group1.id,
                environment_id=self.proj1env1.id,
                key=self.key1,
                value=self.value1,
            )

        assert self.ts.get_group_tag_values(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        ) == []

        gtv = self.ts.create_group_tag_value(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        )

        assert self.ts.get_group_tag_values(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        ) == [gtv]

        assert TagKey.objects.all().count() == 1
        assert TagValue.objects.all().count() == 1

        assert self.ts.get_group_tag_value(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        ).id == gtv.id
        assert GroupTagValue.objects.all().count() == 1

    def test_get_or_create_group_tag_value(self):
        gtv1, _ = self.ts.get_or_create_group_tag_value(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        )

        gtv2, _ = self.ts.get_or_create_group_tag_value(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        )

        assert gtv1.id == gtv2.id

        tk = TagKey.objects.get(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )
        assert TagKey.objects.all().count() == 1

        tv = TagValue.objects.get(
            project_id=self.proj1.id,
            _key__environment_id=self.proj1env1.id,
            _key_id=tk.id,
            value=self.value1,
        )
        assert TagValue.objects.all().count() == 1

        assert GroupTagValue.objects.filter(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            _key__environment_id=self.proj1env1.id,
            _key_id=tk.id,
            _value_id=tv.id,
        ).count() == 1
        assert GroupTagValue.objects.all().count() == 1

    def test_create_event_tags(self):
        v1, _ = self.ts.get_or_create_tag_value(self.proj1.id, self.proj1env1.id, 'k1', 'v1')
        v2, _ = self.ts.get_or_create_tag_value(self.proj1.id, self.proj1env1.id, 'k2', 'v2')
        v3, _ = self.ts.get_or_create_tag_value(self.proj1.id, self.proj1env1.id, 'k3', 'v3')

        tags = [(v1._key, v1), (v2._key, v2), (v3._key, v3)]
        self.ts.create_event_tags(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            event_id=self.proj1group1event1.id,
            tags=[(k.key, v.value) for k, v in tags]
        )

        assert EventTag.objects.count() == 3
        for (k, v) in tags:
            assert EventTag.objects.get(
                project_id=self.proj1.id,
                group_id=self.proj1group1.id,
                key__environment_id=self.proj1env1.id,
                event_id=self.proj1group1event1.id,
                key_id=k.id,
                value_id=v.id,
            ) is not None
            assert set(
                self.ts.get_event_tag_qs(
                    self.proj1.id,
                    self.proj1env1.id,
                    k.key,
                    v.value,
                ).values_list('group_id', flat=True)
            ) == set([self.proj1group1.id])

    def test_delete_tag_key(self):
        tk1 = self.ts.create_tag_key(
            project_id=self.proj1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        tk2 = self.ts.create_tag_key(
            project_id=self.proj1.id,
            environment_id=self.proj1env2.id,
            key=self.key1,
        )

        assert TagKey.objects.filter(
            project_id=self.proj1.id,
            status=TagKeyStatus.VISIBLE,
        ).count() == 2

        deleted = self.ts.delete_tag_key(self.proj1.id, self.key1)
        assert tk1 in deleted
        assert tk2 in deleted

        assert TagKey.objects.filter(
            project_id=self.proj1.id,
            status=TagKeyStatus.VISIBLE,
        ).count() == 0

    def test_delete_all_group_tag_keys(self):
        assert GroupTagKey.objects.count() == 0

        self.ts.create_group_tag_key(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
        )

        assert GroupTagKey.objects.count() == 1

        self.ts.delete_all_group_tag_keys(self.proj1.id, self.proj1group1.id)

        assert GroupTagKey.objects.count() == 0

    def test_delete_all_group_tag_values(self):
        assert GroupTagValue.objects.count() == 0

        self.ts.create_group_tag_value(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key=self.key1,
            value=self.value1,
        )

        assert GroupTagValue.objects.count() == 1

        self.ts.delete_all_group_tag_values(self.proj1.id, self.proj1group1.id)

        assert GroupTagValue.objects.count() == 0

    def test_get_group_event_ids(self):
        tags = {
            'abc': 'xyz',
            'foo': 'bar',
            'baz': 'quux',
        }

        # 2 events with the same tags
        for event in (self.proj1group1event1, self.proj1group1event2):
            self.ts.create_event_tags(
                project_id=self.proj1.id,
                group_id=self.proj1group1.id,
                environment_id=self.proj1env1.id,
                event_id=event.id,
                tags=tags.items(),
            )

        different_tags = {
            'abc': 'DIFFERENT',
            'foo': 'bar',
            'baz': 'quux',
        }

        # 1 event with different tags
        self.ts.create_event_tags(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            event_id=self.proj1group1event3.id,
            tags=different_tags.items(),
        )

        assert len(
            self.ts.get_group_event_ids(
                self.proj1.id,
                self.proj1group1.id,
                self.proj1env1.id,
                tags)) == 2

    def test_get_groups_user_counts(self):
        k1, _ = self.ts.get_or_create_group_tag_key(
            self.proj1.id,
            self.proj1group1.id,
            self.proj1env1.id,
            'sentry:user')
        k1.values_seen = 7
        k1.save()

        k2, _ = self.ts.get_or_create_group_tag_key(
            self.proj1.id,
            self.proj1group2.id,
            self.proj1env1.id,
            'sentry:user')
        k2.values_seen = 11
        k2.save()

        assert dict(
            self.ts.get_groups_user_counts(
                self.proj1.id,
                [self.proj1group1.id, self.proj1group2.id],
                self.proj1env1.id).items()) == {self.proj1group1.id: 7, self.proj1group2.id: 11}

    def test_get_group_tag_value_count(self):
        v1, _ = self.ts.get_or_create_group_tag_value(
            self.proj1.id,
            self.proj1group1.id,
            self.proj1env1.id,
            self.key1,
            'value1')
        v1.times_seen = 7
        v1.save()

        v2, _ = self.ts.get_or_create_group_tag_value(
            self.proj1.id,
            self.proj1group1.id,
            self.proj1env1.id,
            self.key1,
            'value2')
        v2.times_seen = 11
        v2.save()

        assert self.ts.get_group_tag_value_count(
            self.proj1.id,
            self.proj1group1.id,
            self.proj1env1.id,
            self.key1,
        ) == 18

    def test_get_top_group_tag_values(self):
        v1, _ = self.ts.get_or_create_group_tag_value(
            self.proj1.id,
            self.proj1group1.id,
            self.proj1env1.id,
            self.key1,
            'value1')
        v1.times_seen = 7
        v1.save()

        v2, _ = self.ts.get_or_create_group_tag_value(
            self.proj1.id,
            self.proj1group1.id,
            self.proj1env1.id,
            self.key1,
            'value2')
        v2.times_seen = 11
        v2.save()

        resp = self.ts.get_top_group_tag_values(
            self.proj1.id,
            self.proj1group1.id,
            self.proj1env1.id,
            self.key1,
        )

        assert resp[0].times_seen == 11
        assert resp[0].key == self.key1
        assert resp[0].group_id == self.proj1group1.id

        assert resp[1].times_seen == 7
        assert resp[1].key == self.key1
        assert resp[1].group_id == self.proj1group1.id

    def test_get_first_release(self):
        v1, _ = self.ts.get_or_create_group_tag_value(
            self.proj1.id,
            self.proj1group1.id,
            self.proj1env1.id,
            'sentry:release',
            '1.0')
        v1.first_seen = datetime(2000, 1, 1)
        v1.save()

        v2, _ = self.ts.get_or_create_group_tag_value(
            self.proj1.id,
            self.proj1group1.id,
            self.proj1env1.id,
            'sentry:release',
            '2.0')
        v2.first_seen = datetime(2000, 1, 2)
        v2.save()

        assert self.ts.get_first_release(
            self.proj1.id,
            self.proj1group1.id,
        ) == '1.0'

    def test_get_last_release(self):
        v1, _ = self.ts.get_or_create_group_tag_value(
            self.proj1.id,
            self.proj1group1.id,
            self.proj1env1.id,
            'sentry:release',
            '1.0')
        v1.last_seen = datetime(2000, 1, 1)
        v1.save()

        v2, _ = self.ts.get_or_create_group_tag_value(
            self.proj1.id,
            self.proj1group1.id,
            self.proj1env1.id,
            'sentry:release',
            '2.0')
        v2.last_seen = datetime(2000, 1, 2)
        v2.save()

        assert self.ts.get_last_release(
            self.proj1.id,
            self.proj1group1.id,
        ) == '2.0'

    def test_get_release_tags(self):
        tv, _ = self.ts.get_or_create_tag_value(
            self.proj1.id,
            self.proj1env1.id,
            'sentry:release',
            '1.0'
        )

        assert self.ts.get_release_tags([self.proj1.id], self.proj1env1.id, ['1.0']) == [tv]

    def test_get_group_ids_for_users(self):
        from sentry.models import EventUser

        v1, _ = self.ts.get_or_create_group_tag_value(
            self.proj1.id,
            self.proj1group1.id,
            0,
            'sentry:user',
            'email:user@sentry.io')

        eu = EventUser(project_id=self.proj1.id, email='user@sentry.io')

        assert self.ts.get_group_ids_for_users(
            [self.proj1.id],
            [eu]) == [self.proj1group1.id]

    def test_get_group_tag_values_for_users(self):
        from sentry.models import EventUser

        v1, _ = self.ts.get_or_create_group_tag_value(
            self.proj1.id,
            self.proj1group1.id,
            0,
            'sentry:user',
            'email:user@sentry.io')

        eu = EventUser(project_id=self.proj1.id, email='user@sentry.io')

        assert self.ts.get_group_tag_values_for_users([eu]) == [v1]

    def test_get_group_ids_for_search_filter(self):
        tags = {
            'foo': 'bar',
            'baz': 'quux',
        }

        for k, v in tags.items():
            v1, _ = self.ts.get_or_create_group_tag_value(
                self.proj1.id,
                self.proj1group1.id,
                self.proj1env1.id,
                k,
                v)

        end = timezone.now()
        start = end - timedelta(hours=1)
        assert self.ts.get_group_ids_for_search_filter(
            self.proj1.id, self.proj1env1.id, tags, start, end) == [self.proj1group1.id]

    def test_get_group_ids_for_search_filter_predicate_order(self):
        """
            Since each tag-matching filter returns limited results, and each
            filter returns a subset of the previous filter's matches, we
            attempt to match more selective predicates first.

            This tests that we filter by a more selective "divides == even"
            predicate before filtering by an ANY predicate and therefore return
            all matching groups instead of the partial set that would be returned
            if we had filtered and limited using the ANY predicate first.
        """
        for i in range(3):
            self.ts.get_or_create_group_tag_value(
                self.proj1.id, i, self.proj1env1.id,
                'foo', 'bar'
            )

            self.ts.get_or_create_group_tag_value(
                self.proj1.id, i, self.proj1env1.id,
                'divides', 'even' if i % 2 == 0 else 'odd'
            )

        end = timezone.now()
        start = end - timedelta(hours=1)
        assert len(self.ts.get_group_ids_for_search_filter(
            self.proj1.id,
            self.proj1env1.id,
            OrderedDict([('foo', ANY), ('divides', 'even')]),
            start,
            end,
            limit=2
        )) == 2

    def test_update_group_for_events(self):
        v1, _ = self.ts.get_or_create_tag_value(self.proj1.id, self.proj1env1.id, 'k1', 'v1')
        v2, _ = self.ts.get_or_create_tag_value(self.proj1.id, self.proj1env1.id, 'k2', 'v2')
        v3, _ = self.ts.get_or_create_tag_value(self.proj1.id, self.proj1env1.id, 'k3', 'v3')

        tags = [(v1.key, v1.value), (v2.key, v2.value), (v3.key, v3.value)]
        self.ts.create_event_tags(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            event_id=self.proj1group1event1.id,
            tags=tags
        )

        assert EventTag.objects.filter(group_id=self.proj1group2.id).count() == 0

        self.ts.update_group_for_events(
            self.proj1.id, [
                self.proj1group1event1.id], self.proj1group2.id)

        assert EventTag.objects.filter(group_id=self.proj1group2.id).count() == 3
