from sentry.testutils.cases import TestMigrations
from sentry.testutils.cases import SnubaTestCase


class UpdateNumericToBooleanTest(TestMigrations, SnubaTestCase):
    migrate_from = "0010_remove_last_received_from_attribute_context"
    migrate_to = "0011_update_if_syntax_on_spans"
    app = "explore"

    def setup_before_migration(self, apps):
        ExploreSavedQuery = apps.get_model("explore", "ExploreSavedQuery")
        ExploreSavedQueryProject = apps.get_model("explore", "ExploreSavedQueryProject")

        self.query_1 = ExploreSavedQuery.objects.create(
            organization_id=self.organization.id,
            name="Query",
            dataset=0,
            query={
                "name": "Query",
                "projects": [-1],
                "range": "7d",
                "query": [
                    {
                        "fields": [],
                        "query": "",
                        "mode": "samples",
                        "aggregateField": [
                            {
                                "groupBy": "span.op",
                                "yAxes": ["count_if(span.duration,greater,100)"],
                                "chartType": 0,
                            },
                            {
                                "groupBy": "span.op",
                                "yAxes": ["count_if(span.duration,notEquals,100)"],
                                "chartType": 0,
                            },
                            {
                                "groupBy": "span.op",
                                "yAxes": ["count_if(span.duration,lessOrEquals,100)"],
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
                    "fields": [],
                    "query": "",
                    "mode": "samples",
                    "aggregateField": [
                        {
                            "groupBy": "span.op",
                            "yAxes": ["count_if(`span.duration:>100`)"],
                            "chartType": 0,
                        },
                        {
                            "groupBy": "span.op",
                            "yAxes": ["count_if(`!span.duration:100`)"],
                            "chartType": 0,
                        },
                        {
                            "groupBy": "span.op",
                            "yAxes": ["count_if(`span.duration:<=100`)"],
                            "chartType": 0,
                        },
                    ],
                }
            ],
            "interval": "1m",
        }
