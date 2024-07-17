from datetime import UTC, datetime, timedelta

from sentry.models.grouphash import GroupHash
from sentry.receivers import create_default_projects
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.snuba.utils import build_query_strings
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.utils import snuba


class SnubaUtilTest(TestCase, SnubaTestCase):
    def test_filter_keys_set(self):
        create_default_projects()
        snuba.raw_query(
            start=datetime.now(),
            end=datetime.now(),
            filter_keys={"project_id": {1}, "culprit": {"asdf"}},
            aggregations=[["count()", "", "count"]],
            tenant_ids={"referrer": "bleh", "organization_id": 123},
        )

    def test_shrink_timeframe(self):
        now = datetime.now(UTC)
        naive_now = now.replace(tzinfo=None)
        year_ago = naive_now - timedelta(days=365)

        # issues of None / empty list
        assert snuba.shrink_time_window(None, year_ago) == year_ago
        assert snuba.shrink_time_window([], year_ago) == year_ago

        group1 = self.create_group()
        group1.first_seen = now - timedelta(hours=1)
        group1.last_seen = now
        group1.save()
        GroupHash.objects.create(project_id=group1.project_id, group=group1, hash="a" * 32)

        group2 = self.create_group()
        GroupHash.objects.create(project_id=group2.project_id, group=group2, hash="b" * 32)

        issues = [group1.id]
        assert snuba.shrink_time_window(issues, year_ago) == naive_now - timedelta(
            hours=1, minutes=5
        )

        issues = [group1.id, group2.id]
        assert snuba.shrink_time_window(issues, year_ago) == year_ago

        # with pytest.raises(snuba.QueryOutsideGroupActivityError):
        #    # query a group for a time range before it had any activity
        #    snuba.raw_query(
        #        start=group1.first_seen - timedelta(days=1, hours=1),
        #        end=group1.first_seen - timedelta(days=1),
        #        filter_keys={
        #            'project_id': [group1.project_id],
        #            'issue': [group1.id],
        #        },
        #        aggregations=[
        #            ['count()', '', 'count'],
        #        ],
        #    )

    def test_override_options(self):
        assert snuba.OVERRIDE_OPTIONS == {"consistent": False}
        with snuba.options_override({"foo": 1}):
            assert snuba.OVERRIDE_OPTIONS == {"foo": 1, "consistent": False}
            with snuba.options_override({"foo": 2}):
                assert snuba.OVERRIDE_OPTIONS == {"foo": 2, "consistent": False}
            assert snuba.OVERRIDE_OPTIONS == {"foo": 1, "consistent": False}
        assert snuba.OVERRIDE_OPTIONS == {"consistent": False}

    def test_build_query_strings(self):
        snuba_query_no_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            aggregate="count()",
            time_window=60,
            resolution=60,
        )
        subscription_noquery = QuerySubscription.objects.create(
            status=QuerySubscription.Status.CREATING.value,
            project=self.project,
            snuba_query=snuba_query_no_query,
            query_extra="foobar",
        )
        query_strings = build_query_strings(subscription_noquery, snuba_query_no_query)
        assert query_strings.query_string == "foobar"
        assert query_strings.query == ""
        assert query_strings.query_extra == "foobar"

        snuba_query_with_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            aggregate="count()",
            time_window=60,
            resolution=60,
            query="event.type:error",
        )
        subscription_with_query = QuerySubscription.objects.create(
            status=QuerySubscription.Status.CREATING.value,
            project=self.project,
            snuba_query=snuba_query_with_query,
            query_extra="foobar",
        )

        query_strings = build_query_strings(subscription_with_query, snuba_query_with_query)
        assert query_strings.query_string == "event.type:error and foobar"
        assert query_strings.query == "event.type:error"
        assert query_strings.query_extra == " and foobar"
