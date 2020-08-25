from __future__ import absolute_import

import calendar
from datetime import timedelta
import pytest
import requests
import six

from django.conf import settings
from django.utils import timezone

from sentry.models import GroupHash, EventUser
from sentry.tagstore.exceptions import (
    GroupTagKeyNotFound,
    GroupTagValueNotFound,
    TagKeyNotFound,
    TagValueNotFound,
)
from sentry.tagstore.snuba.backend import SnubaTagStorage
from sentry.testutils import SnubaTestCase, TestCase
from sentry.utils import json


class TagStorageTest(TestCase, SnubaTestCase):
    def setUp(self):
        super(TagStorageTest, self).setUp()

        self.ts = SnubaTagStorage()

        self.proj1 = self.create_project()
        self.proj1env1 = self.create_environment(project=self.proj1, name="test")
        self.proj1env2 = self.create_environment(project=self.proj1, name="test2")

        self.proj1group1 = self.create_group(self.proj1)
        self.proj1group2 = self.create_group(self.proj1)

        hash1 = "1" * 32
        hash2 = "2" * 32
        GroupHash.objects.create(project=self.proj1, group=self.proj1group1, hash=hash1)
        GroupHash.objects.create(project=self.proj1, group=self.proj1group2, hash=hash2)

        self.now = timezone.now().replace(microsecond=0)
        data = json.dumps(
            [
                (
                    2,
                    "insert",
                    {
                        "event_id": six.text_type(r) * 32,
                        "primary_hash": hash1,
                        "group_id": self.proj1group1.id,
                        "project_id": self.proj1.id,
                        "message": "message 1",
                        "platform": "python",
                        "datetime": (self.now - timedelta(seconds=r)).strftime(
                            "%Y-%m-%dT%H:%M:%S.%fZ"
                        ),
                        "data": {
                            "received": calendar.timegm(self.now.timetuple()) - r,
                            "tags": {
                                "foo": "bar",
                                "baz": "quux",
                                "environment": self.proj1env1.name,
                                "sentry:release": 100 * r,
                                "sentry:user": u"id:user{}".format(r),
                            },
                            "user": {
                                "id": u"user{}".format(r),
                                "email": u"user{}@sentry.io".format(r),
                            },
                            "exception": {"values": [{"stacktrace": {"frames": [{"lineno": 29}]}}]},
                        },
                    },
                )
                for r in [1, 2]
            ]
            + [
                (
                    2,
                    "insert",
                    {
                        "event_id": "3" * 32,
                        "primary_hash": hash2,
                        "group_id": self.proj1group2.id,
                        "project_id": self.proj1.id,
                        "message": "message 2",
                        "platform": "python",
                        "datetime": (self.now - timedelta(seconds=2)).strftime(
                            "%Y-%m-%dT%H:%M:%S.%fZ"
                        ),
                        "data": {
                            "received": calendar.timegm(self.now.timetuple()) - 2,
                            "tags": {
                                "browser": "chrome",
                                "environment": self.proj1env1.name,
                                "sentry:user": "id:user1",
                            },
                            "user": {"id": "user1"},
                        },
                    },
                )
            ]
            + [
                (
                    2,
                    "insert",
                    {
                        "event_id": "4" * 32,
                        "primary_hash": hash2,
                        "group_id": self.proj1group1.id,
                        "project_id": self.proj1.id,
                        "message": "message 2",
                        "platform": "python",
                        "datetime": (self.now - timedelta(seconds=2)).strftime(
                            "%Y-%m-%dT%H:%M:%S.%fZ"
                        ),
                        "data": {
                            "received": calendar.timegm(self.now.timetuple()) - 2,
                            "tags": {"foo": "bar", "environment": self.proj1env2.name},
                            "user": {"id": "user1"},
                        },
                    },
                )
            ]
        )

        assert (
            requests.post(settings.SENTRY_SNUBA + "/tests/events/insert", data=data).status_code
            == 200
        )

    def test_get_group_tag_keys_and_top_values(self):
        result = list(
            self.ts.get_group_tag_keys_and_top_values(
                self.proj1.id, self.proj1group1.id, [self.proj1env1.id]
            )
        )
        tags = [r.key for r in result]
        assert set(tags) == set(["foo", "baz", "environment", "sentry:release", "sentry:user"])

        result.sort(key=lambda r: r.key)
        assert result[0].key == "baz"
        assert result[0].top_values[0].value == "quux"
        assert result[0].count == 2

        assert result[3].key == "sentry:release"
        assert result[3].count == 2
        top_release_values = result[3].top_values
        assert len(top_release_values) == 2
        assert set(v.value for v in top_release_values) == set(["100", "200"])
        assert all(v.times_seen == 1 for v in top_release_values)

        # Now with only a specific set of keys,
        result = list(
            self.ts.get_group_tag_keys_and_top_values(
                self.proj1.id,
                self.proj1group1.id,
                [self.proj1env1.id],
                keys=["environment", "sentry:release"],
            )
        )
        tags = [r.key for r in result]
        assert set(tags) == set(["environment", "sentry:release"])

        result.sort(key=lambda r: r.key)
        assert result[0].key == "environment"
        assert result[0].top_values[0].value == "test"

        assert result[1].key == "sentry:release"
        top_release_values = result[1].top_values
        assert len(top_release_values) == 2
        assert set(v.value for v in top_release_values) == set(["100", "200"])
        assert all(v.times_seen == 1 for v in top_release_values)

    def test_get_top_group_tag_values(self):
        resp = self.ts.get_top_group_tag_values(
            self.proj1.id, self.proj1group1.id, self.proj1env1.id, "foo", 1
        )
        assert len(resp) == 1
        assert resp[0].times_seen == 2
        assert resp[0].key == "foo"
        assert resp[0].value == "bar"
        assert resp[0].group_id == self.proj1group1.id

    def test_get_group_tag_value_count(self):
        assert (
            self.ts.get_group_tag_value_count(
                self.proj1.id, self.proj1group1.id, self.proj1env1.id, "foo"
            )
            == 2
        )

    def test_get_tag_keys(self):
        expected_keys = set(
            ["baz", "browser", "environment", "foo", "sentry:release", "sentry:user"]
        )
        keys = {
            k.key: k
            for k in self.ts.get_tag_keys(
                project_id=self.proj1.id, environment_id=self.proj1env1.id
            )
        }
        assert set(keys) == expected_keys
        keys = {
            k.key: k
            for k in self.ts.get_tag_keys(
                project_id=self.proj1.id, environment_id=self.proj1env1.id, include_values_seen=True
            )
        }
        assert set(keys) == expected_keys

    def test_get_group_tag_key(self):
        with pytest.raises(GroupTagKeyNotFound):
            self.ts.get_group_tag_key(
                project_id=self.proj1.id,
                group_id=self.proj1group1.id,
                environment_id=self.proj1env1.id,
                key="notreal",
            )

        assert (
            self.ts.get_group_tag_key(
                project_id=self.proj1.id,
                group_id=self.proj1group1.id,
                environment_id=self.proj1env1.id,
                key="foo",
            ).key
            == "foo"
        )

        keys = {
            k.key: k
            for k in self.ts.get_group_tag_keys(
                project_id=self.proj1.id,
                group_id=self.proj1group1.id,
                environment_ids=[self.proj1env1.id],
            )
        }
        assert set(keys) == set(["baz", "environment", "foo", "sentry:release", "sentry:user"])

    def test_get_group_tag_value(self):
        with pytest.raises(GroupTagValueNotFound):
            self.ts.get_group_tag_value(
                project_id=self.proj1.id,
                group_id=self.proj1group1.id,
                environment_id=self.proj1env1.id,
                key="foo",
                value="notreal",
            )

        assert self.ts.get_group_tag_values(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            environment_id=self.proj1env1.id,
            key="notreal",
        ) == set([])

        assert (
            list(
                self.ts.get_group_tag_values(
                    project_id=self.proj1.id,
                    group_id=self.proj1group1.id,
                    environment_id=self.proj1env1.id,
                    key="foo",
                )
            )[0].value
            == "bar"
        )

        assert (
            self.ts.get_group_tag_value(
                project_id=self.proj1.id,
                group_id=self.proj1group1.id,
                environment_id=self.proj1env1.id,
                key="foo",
                value="bar",
            ).value
            == "bar"
        )

    def test_get_tag_key(self):
        with pytest.raises(TagKeyNotFound):
            self.ts.get_tag_key(
                project_id=self.proj1.id, environment_id=self.proj1env1.id, key="notreal"
            )

    def test_get_tag_value(self):
        with pytest.raises(TagValueNotFound):
            self.ts.get_tag_value(
                project_id=self.proj1.id,
                environment_id=self.proj1env1.id,
                key="foo",
                value="notreal",
            )

    def test_get_tag_value_label(self):
        assert self.ts.get_tag_value_label("foo", "notreal") == "notreal"
        assert self.ts.get_tag_value_label("sentry:user", None) is None
        assert self.ts.get_tag_value_label("sentry:user", "id:stuff") == "stuff"
        assert self.ts.get_tag_value_label("sentry:user", "email:stuff") == "stuff"
        assert self.ts.get_tag_value_label("sentry:user", "username:stuff") == "stuff"
        assert self.ts.get_tag_value_label("sentry:user", "ip:stuff") == "stuff"

    def test_get_groups_user_counts(self):
        assert self.ts.get_groups_user_counts(
            project_ids=[self.proj1.id],
            group_ids=[self.proj1group1.id, self.proj1group2.id],
            environment_ids=[self.proj1env1.id],
        ) == {self.proj1group1.id: 2, self.proj1group2.id: 1}

        # test filtering by date range where there shouldn't be results
        assert (
            self.ts.get_groups_user_counts(
                project_ids=[self.proj1.id],
                group_ids=[self.proj1group1.id, self.proj1group2.id],
                environment_ids=[self.proj1env1.id],
                start=self.now - timedelta(days=5),
                end=self.now - timedelta(days=4),
            )
            == {}
        )

    def test_get_releases(self):
        assert (
            self.ts.get_first_release(project_id=self.proj1.id, group_id=self.proj1group1.id)
            == "200"
        )

        assert (
            self.ts.get_first_release(project_id=self.proj1.id, group_id=self.proj1group2.id)
            is None
        )

        assert (
            self.ts.get_last_release(project_id=self.proj1.id, group_id=self.proj1group1.id)
            == "100"
        )

        assert (
            self.ts.get_last_release(project_id=self.proj1.id, group_id=self.proj1group2.id) is None
        )

    def test_get_group_ids_for_users(self):
        assert self.ts.get_group_ids_for_users(
            [self.proj1.id], [EventUser(project_id=self.proj1.id, ident="user1")]
        ) == set([self.proj1group1.id, self.proj1group2.id])

        assert self.ts.get_group_ids_for_users(
            [self.proj1.id], [EventUser(project_id=self.proj1.id, ident="user2")]
        ) == set([self.proj1group1.id])

    def test_get_group_tag_values_for_users(self):
        result = self.ts.get_group_tag_values_for_users(
            [EventUser(project_id=self.proj1.id, ident="user1")]
        )
        assert len(result) == 2
        assert set(v.group_id for v in result) == set([self.proj1group1.id, self.proj1group2.id])
        assert set(v.last_seen for v in result) == set(
            [self.now - timedelta(seconds=1), self.now - timedelta(seconds=2)]
        )
        result.sort(key=lambda x: x.last_seen)
        assert result[0].last_seen == self.now - timedelta(seconds=2)
        assert result[1].last_seen == self.now - timedelta(seconds=1)
        for v in result:
            assert v.value == "user1"

        result = self.ts.get_group_tag_values_for_users(
            [EventUser(project_id=self.proj1.id, ident="user2")]
        )
        assert len(result) == 1
        assert result[0].value == "user2"
        assert result[0].last_seen == self.now - timedelta(seconds=2)

    def test_get_release_tags(self):
        tags = list(self.ts.get_release_tags([self.proj1.id], None, ["100"]))

        assert len(tags) == 1
        one_second_ago = self.now - timedelta(seconds=1)
        assert tags[0].last_seen == one_second_ago
        assert tags[0].first_seen == one_second_ago
        assert tags[0].times_seen == 1
        assert tags[0].key == "sentry:release"

    def test_get_group_event_filter(self):
        assert self.ts.get_group_event_filter(
            self.proj1.id, self.proj1group1.id, [self.proj1env1.id], {"foo": "bar"}, None, None
        ) == {"event_id__in": set(["1" * 32, "2" * 32])}

        assert self.ts.get_group_event_filter(
            self.proj1.id,
            self.proj1group1.id,
            [self.proj1env1.id],
            {"foo": "bar"},
            (self.now - timedelta(seconds=1)),
            None,
        ) == {"event_id__in": set(["1" * 32])}

        assert self.ts.get_group_event_filter(
            self.proj1.id,
            self.proj1group1.id,
            [self.proj1env1.id],
            {"foo": "bar"},
            None,
            (self.now - timedelta(seconds=1)),
        ) == {"event_id__in": set(["2" * 32])}

        assert self.ts.get_group_event_filter(
            self.proj1.id,
            self.proj1group1.id,
            [self.proj1env1.id, self.proj1env2.id],
            {"foo": "bar"},
            None,
            None,
        ) == {"event_id__in": set(["1" * 32, "2" * 32, "4" * 32])}

        assert self.ts.get_group_event_filter(
            self.proj1.id,
            self.proj1group1.id,
            [self.proj1env1.id],
            {"foo": "bar", "sentry:release": "200"},  # AND
            None,
            None,
        ) == {"event_id__in": set(["2" * 32])}

        assert self.ts.get_group_event_filter(
            self.proj1.id,
            self.proj1group2.id,
            [self.proj1env1.id],
            {"browser": "chrome"},
            None,
            None,
        ) == {"event_id__in": set(["3" * 32])}

        assert (
            self.ts.get_group_event_filter(
                self.proj1.id,
                self.proj1group2.id,
                [self.proj1env1.id],
                {"browser": "ie"},
                None,
                None,
            )
            is None
        )

    def test_get_tag_value_paginator(self):
        from sentry.tagstore.types import TagValue

        assert list(
            self.ts.get_tag_value_paginator(
                self.proj1.id, self.proj1env1.id, "sentry:user"
            ).get_result(10)
        ) == [
            TagValue(
                key="sentry:user",
                value="id:user1",
                times_seen=2,
                first_seen=self.now - timedelta(seconds=2),
                last_seen=self.now - timedelta(seconds=1),
            ),
            TagValue(
                key="sentry:user",
                value="id:user2",
                times_seen=1,
                first_seen=self.now - timedelta(seconds=2),
                last_seen=self.now - timedelta(seconds=2),
            ),
        ]

        assert list(
            self.ts.get_tag_value_paginator(
                self.proj1.id, self.proj1env1.id, "sentry:user", query="user1"
            ).get_result(10)
        ) == [
            TagValue(
                key="sentry:user",
                value="id:user1",
                times_seen=2,
                first_seen=self.now - timedelta(seconds=2),
                last_seen=self.now - timedelta(seconds=1),
            )
        ]

    def test_get_tag_value_paginator_with_dates(self):
        from sentry.tagstore.types import TagValue

        day_ago = self.now - timedelta(days=1)
        two_days_ago = self.now - timedelta(days=2)
        assert list(
            self.ts.get_tag_value_paginator(
                self.proj1.id, self.proj1env1.id, "sentry:user", start=day_ago, end=self.now
            ).get_result(10)
        ) == [
            TagValue(
                key="sentry:user",
                value="id:user1",
                times_seen=2,
                first_seen=self.now - timedelta(seconds=2),
                last_seen=self.now - timedelta(seconds=1),
            ),
            TagValue(
                key="sentry:user",
                value="id:user2",
                times_seen=1,
                first_seen=self.now - timedelta(seconds=2),
                last_seen=self.now - timedelta(seconds=2),
            ),
        ]

        day_ago = self.now - timedelta(days=1)
        assert (
            list(
                self.ts.get_tag_value_paginator(
                    self.proj1.id, self.proj1env1.id, "sentry:user", start=two_days_ago, end=day_ago
                ).get_result(10)
            )
            == []
        )

    def test_numeric_tag_value_paginator(self):
        from sentry.tagstore.types import TagValue

        assert list(
            self.ts.get_tag_value_paginator(
                self.proj1.id, self.proj1env1.id, "stack.lineno"
            ).get_result(10)
        ) == [
            TagValue(
                key="stack.lineno",
                value="29",
                times_seen=2,
                first_seen=self.now - timedelta(seconds=2),
                last_seen=self.now - timedelta(seconds=1),
            )
        ]

        assert list(
            self.ts.get_tag_value_paginator(
                self.proj1.id, self.proj1env1.id, "stack.lineno", query="30"
            ).get_result(10)
        ) == [
            TagValue(
                key="stack.lineno",
                value="29",
                times_seen=2,
                first_seen=self.now - timedelta(seconds=2),
                last_seen=self.now - timedelta(seconds=1),
            )
        ]

    def test_get_group_tag_value_iter(self):
        from sentry.tagstore.types import GroupTagValue

        assert list(
            self.ts.get_group_tag_value_iter(
                self.proj1.id, self.proj1group1.id, [self.proj1env1.id], "sentry:user"
            )
        ) == [
            GroupTagValue(
                group_id=self.proj1group1.id,
                key="sentry:user",
                value="id:user1",
                times_seen=1,
                first_seen=self.now - timedelta(seconds=1),
                last_seen=self.now - timedelta(seconds=1),
            ),
            GroupTagValue(
                group_id=self.proj1group1.id,
                key="sentry:user",
                value="id:user2",
                times_seen=1,
                first_seen=self.now - timedelta(seconds=2),
                last_seen=self.now - timedelta(seconds=2),
            ),
        ]

    def test_get_group_tag_value_paginator(self):
        from sentry.tagstore.types import GroupTagValue

        assert list(
            self.ts.get_group_tag_value_paginator(
                self.proj1.id, self.proj1group1.id, [self.proj1env1.id], "sentry:user"
            ).get_result(10)
        ) == [
            GroupTagValue(
                group_id=self.proj1group1.id,
                key="sentry:user",
                value="id:user1",
                times_seen=1,
                first_seen=self.now - timedelta(seconds=1),
                last_seen=self.now - timedelta(seconds=1),
            ),
            GroupTagValue(
                group_id=self.proj1group1.id,
                key="sentry:user",
                value="id:user2",
                times_seen=1,
                first_seen=self.now - timedelta(seconds=2),
                last_seen=self.now - timedelta(seconds=2),
            ),
        ]

    def test_get_group_seen_values_for_environments(self):
        assert self.ts.get_group_seen_values_for_environments(
            [self.proj1.id], [self.proj1group1.id], [self.proj1env1.id], []
        ) == {
            self.proj1group1.id: {
                "first_seen": self.now - timedelta(seconds=2),
                "last_seen": self.now - timedelta(seconds=1),
                "times_seen": 2,
            }
        }

        # test where there should be no results because of time filters
        assert (
            self.ts.get_group_seen_values_for_environments(
                [self.proj1.id],
                [self.proj1group1.id],
                [self.proj1env1.id],
                [],
                start=self.now - timedelta(hours=5),
                end=self.now - timedelta(hours=4),
            )
            == {}
        )
