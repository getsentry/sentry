from sentry.testutils.cases import SnubaTestCase, TestMigrations


class UpdateIfSyntaxOnSpansTest(TestMigrations, SnubaTestCase):
    migrate_from = "0015_add_dataset_to_formulas"
    migrate_to = "0016_update_if_syntax_on_spans"
    app = "explore"

    def setup_before_migration(self, apps):
        ExploreSavedQuery = apps.get_model("explore", "ExploreSavedQuery")
        ExploreSavedQueryProject = apps.get_model("explore", "ExploreSavedQueryProject")

        def create_query(*, name, dataset, query):
            saved = ExploreSavedQuery.objects.create(
                organization_id=self.organization.id,
                name=name,
                dataset=dataset,
                query=query,
            )
            ExploreSavedQueryProject.objects.create(
                project_id=self.project.id, explore_saved_query_id=saved.id
            )
            return saved

        # Basic aggregate + orderby rewrites (spans dataset)
        self.query_basic = create_query(
            name="Basic if combinators",
            dataset=0,
            query={
                "name": "Basic if combinators",
                "projects": [-1],
                "range": "7d",
                "query": [
                    {
                        "fields": [],
                        "query": "",
                        "mode": "samples",
                        "orderby": "-count_if(span.duration,greater,100)",
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
                                "yAxes": ["count_if(span.duration,between,100,199)"],
                                "chartType": 0,
                            },
                            {
                                "groupBy": "span.op",
                                "chartType": 0,
                            },
                            {
                                "groupBy": "span.op",
                                "yAxes": ["avg_if(span.duration,span.duration,lessOrEquals,100)"],
                                "chartType": 0,
                            },
                            {
                                "groupBy": "span.op",
                                "yAxes": [
                                    "equation|avg_if(span.duration,span.duration,lessOrEquals,100) + count_if(span.duration,greaterOrEquals,100)"
                                ],
                                "chartType": 0,
                            },
                            {
                                "groupBy": "span.op",
                                "yAxes": ["failure_count_if(span.duration,lessOrEquals,100)"],
                                "chartType": 0,
                            },
                        ],
                    }
                ],
                "interval": "1m",
            },
        )

        # Patterns drawn from production saved queries (anonymized):
        # multi-_if equations, between, tags with commas, duration units, colon values
        self.query_equations = create_query(
            name="Equation if combinators",
            dataset=0,
            query={
                "name": "Equation if combinators",
                "projects": [-1],
                "range": "1h",
                "query": [
                    {
                        "mode": "samples",
                        "query": "",
                        "fields": ["id", "timestamp"],
                        "orderby": "-timestamp",
                        "aggregateField": [
                            {
                                "yAxes": [
                                    "equation|( count_if(http.response_status_code,greater,399) - count_if(http.response_status_code,greater,499)) / count() * 100"
                                ],
                            },
                            {
                                "yAxes": [
                                    "equation|( count_if(span.status_code,between,400,499) / count(span.duration) ) * 100"
                                ],
                            },
                            {
                                "yAxes": [
                                    "equation|( count_if(span.status,notEquals,ok) / count() ) * 100"
                                ],
                            },
                            {
                                "yAxes": [
                                    "equation|( count_if(tags[http.response.status_code,number],notEquals,202) / count() ) * 1"
                                ],
                            },
                            {
                                "yAxes": [
                                    "equation|count_if(span.description,equals,a:b:c) / count_if(span.description,equals,c:b:a)"
                                ],
                            },
                        ],
                        "caseInsensitive": False,
                    }
                ],
                "interval": "1m",
                "environment": [],
            },
        )

        # Duration-unit thresholds (dataset 101 / transactions-as-spans)
        self.query_duration_units = create_query(
            name="Duration unit if combinators",
            dataset=101,
            query={
                "end": None,
                "query": [
                    {
                        "mode": "samples",
                        "query": "is_transaction:1",
                        "fields": ["id"],
                        "orderby": "",
                        "aggregateField": [
                            {
                                "yAxes": ["equation|count_if(span.duration,greater,7s)"],
                            },
                            {
                                "yAxes": ["equation|count_if(span.duration,less,7s)"],
                            },
                            {
                                "yAxes": [
                                    "equation|count_if(span.duration,less,7s)/(count_if(span.duration,greater,7s)+count_if(span.duration,less,7s))"
                                ],
                            },
                        ],
                        "aggregateOrderby": None,
                    }
                ],
                "range": "30d",
                "start": None,
                "interval": None,
                "environment": [],
            },
        )

        # Already on new syntax — must stay unchanged (idempotent re-run)
        self.query_already_migrated = create_query(
            name="Already migrated if combinators",
            dataset=0,
            query={
                "name": "Already migrated if combinators",
                "projects": [-1],
                "range": "14d",
                "query": [
                    {
                        "mode": "samples",
                        "query": "",
                        "fields": ["id", "timestamp"],
                        "orderby": "-timestamp",
                        "aggregateField": [
                            {
                                "yAxes": [
                                    "count_if(`span.description:/api/0/organizations/{organization_id_or_slug}/events/`,span.duration)"
                                ],
                            },
                            {
                                "yAxes": [
                                    "equation|count_if(`span.description:*/events/`,span.duration)"
                                ],
                            },
                        ],
                        "caseInsensitive": False,
                    }
                ],
                "interval": "1h",
                "environment": [],
            },
        )

        return super().setup_before_migration(apps)

    def test_basic_aggregates_and_orderby(self):
        self.query_basic.refresh_from_db()
        assert self.query_basic.query == {
            "name": "Basic if combinators",
            "projects": [-1],
            "range": "7d",
            "query": [
                {
                    "fields": [],
                    "query": "",
                    "mode": "samples",
                    "orderby": "-count_if(`span.duration:>100`)",
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
                            "yAxes": ["count_if(`span.duration:>=100 and span.duration:<=199`)"],
                            "chartType": 0,
                        },
                        {
                            "groupBy": "span.op",
                            "chartType": 0,
                        },
                        {
                            "groupBy": "span.op",
                            "yAxes": ["avg_if(`span.duration:<=100`,span.duration)"],
                            "chartType": 0,
                        },
                        {
                            "groupBy": "span.op",
                            "yAxes": [
                                "equation|avg_if(`span.duration:<=100`,span.duration) + count_if(`span.duration:>=100`)"
                            ],
                            "chartType": 0,
                        },
                        # Untouched — failure_count_if is skipped
                        {
                            "groupBy": "span.op",
                            "yAxes": ["failure_count_if(span.duration,lessOrEquals,100)"],
                            "chartType": 0,
                        },
                    ],
                }
            ],
            "interval": "1m",
        }

    def test_equation_patterns_from_production(self):
        self.query_equations.refresh_from_db()
        y_axes = [
            field["yAxes"][0] for field in self.query_equations.query["query"][0]["aggregateField"]
        ]
        assert y_axes == [
            "equation|( count_if(`http.response_status_code:>399`) - count_if(`http.response_status_code:>499`)) / count() * 100",
            "equation|( count_if(`span.status_code:>=400 and span.status_code:<=499`) / count(span.duration) ) * 100",
            "equation|( count_if(`!span.status:ok`) / count() ) * 100",
            "equation|( count_if(`!tags[http.response.status_code,number]:202`) / count() ) * 1",
            "equation|count_if(`span.description:a:b:c`) / count_if(`span.description:c:b:a`)",
        ]

    def test_duration_unit_thresholds(self):
        self.query_duration_units.refresh_from_db()
        y_axes = [
            field["yAxes"][0]
            for field in self.query_duration_units.query["query"][0]["aggregateField"]
        ]
        assert y_axes == [
            "equation|count_if(`span.duration:>7s`)",
            "equation|count_if(`span.duration:<7s`)",
            "equation|count_if(`span.duration:<7s`)/(count_if(`span.duration:>7s`)+count_if(`span.duration:<7s`))",
        ]

    def test_already_migrated_unchanged(self):
        self.query_already_migrated.refresh_from_db()
        y_axes = [
            field["yAxes"][0]
            for field in self.query_already_migrated.query["query"][0]["aggregateField"]
        ]
        assert y_axes == [
            "count_if(`span.description:/api/0/organizations/{organization_id_or_slug}/events/`,span.duration)",
            "equation|count_if(`span.description:*/events/`,span.duration)",
        ]
