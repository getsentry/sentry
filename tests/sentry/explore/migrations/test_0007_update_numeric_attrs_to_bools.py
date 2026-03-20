from sentry.testutils.cases import TestMigrations
from sentry.testutils.cases import SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.explore.models import ExploreSavedQueryDataset


class UpdateNumericToBooleanTest(TestMigrations, SnubaTestCase, SpanTestCase):
    migrate_from = "0006_add_changed_reason_field_explore"
    migrate_to = "0007_update_numeric_attrs_to_bools"
    app = "explore"

    def setup_before_migration(self, apps):
        ExploreSavedQuery = apps.get_model("explore", "ExploreSavedQuery")
        ExploreSavedQueryProject = apps.get_model("explore", "ExploreSavedQueryProject")

        span1 = self.create_span(start_ts=before_now(days=0, minutes=10))
        span1["data"] = {
            "test_with_space": True,
            "test_without_space": True,
            "dont_touch": 123,
            "is_debug": False,
        }
        self.store_spans([span1])

        self.query_1 = ExploreSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="Query",
            query={
                "name": "Query",
                "projects": [-1],
                "range": "7d",
                "query": [
                    {
                        "fields": [
                            "tags[test_without_space,number]",
                            "tags[test_with_space, number]",
                            "tags[dont_touch, number]",
                        ],
                        "query": "tags[test_without_space,number]:0 tags[test_with_space, number]:1 tags[dont_touch,number]:1",
                        "mode": "samples",
                        "aggregateField": [
                            {
                                "groupBy": "span.op",
                                "yAxes": ["count(span.duration)"],
                                "chartType": 0,
                            },
                        ],
                    }
                ],
                "interval": "1m",
            },
        )
        self.wrong_dataset_query = ExploreSavedQuery.objects.create(
            organization_id=self.organization.id,
            dataset=ExploreSavedQueryDataset.METRICS,
            name="Query",
            query={
                "name": "Query",
                "projects": [-1],
                "range": "7d",
                "query": [
                    {
                        "fields": [
                            "tags[test_without_space,number]",
                            "tags[test_with_space, number]",
                            "tags[dont_touch, number]",
                        ],
                        "query": "tags[test_without_space,number]:0 tags[test_with_space, number]:1 tags[dont_touch,number]:1",
                        "mode": "samples",
                        "aggregateField": [
                            {
                                "groupBy": "span.op",
                                "yAxes": ["count(span.duration)"],
                                "chartType": 0,
                            },
                        ],
                    }
                ],
                "interval": "1m",
            },
        )
        ExploreSavedQueryProject.objects.create(
            project_id=self.project.id, explore_saved_query=self.query_1
        )
        ExploreSavedQueryProject.objects.create(
            project_id=self.project.id, explore_saved_query=self.wrong_dataset_query
        )

        return super().setup_before_migration(apps)

    def test_migration(self):
        # Test state after migration
        self.query_1.refresh_from_db()
        assert self.query_1.query == {
            "name": "Query",
            "projects": [-1],
            "range": "7d",
            "query": [
                {
                    "fields": [
                        "tags[test_without_space,boolean]",
                        "tags[test_with_space,boolean]",
                        "tags[dont_touch, number]",
                    ],
                    "query": "tags[test_without_space,boolean]:False tags[test_with_space, boolean]:True tags[dont_touch,number]:1",
                    "mode": "samples",
                    "aggregateField": [
                        {
                            "groupBy": "span.op",
                            "yAxes": ["count(span.duration)"],
                            "chartType": 0,
                        },
                    ],
                }
            ],
            "interval": "1m",
        }
