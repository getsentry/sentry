import uuid
from datetime import datetime
from typing import Sequence

import pytest

from sentry.sentry_metrics.indexer.cloudspanner import CloudSpannerIndexer
from sentry.sentry_metrics.indexer.cloudspanner_model import get_column_names, \
    CloudSpannerInsertMode, SpannerIndexerModel, CloudSpannerDBAccessor


def test_cloudspanner_model_column_names() -> None:
    assert get_column_names() == [
        "id",
        "decoded_id",
        "string",
        "organization_id",
        "date_added",
        "last_seen",
        "retention_days",
    ]

@pytest.mark.skip(reason="TODO: Implement it correctly")
@pytest.mark.parametrize(
    "mode,models",
    [
        pytest.param(
            CloudSpannerInsertMode.MUTATION,
            [
                SpannerIndexerModel(
                    id=(uuid.uuid4().int & (1 << 64) - 1) >> 1,
                    decoded_id=12345,
                    string="string",
                    organization_id=1,
                    retention_days=90,
                    date_added=datetime.now(),
                    last_seen=datetime.now(),
                )
            ],
            id="mutation single write",
        ),
        pytest.param(
            CloudSpannerInsertMode.MUTATION,
            [
                SpannerIndexerModel(
                    id=(uuid.uuid4().int & (1 << 64) - 1) >> 1,
                    decoded_id=12345,
                    string="string 1",
                    organization_id=1,
                    retention_days=90,
                    date_added=datetime.now(),
                    last_seen=datetime.now(),
                ),
                SpannerIndexerModel(
                    id=(uuid.uuid4().int & (1 << 64) - 1) >> 1,
                    decoded_id=12345,
                    string="string 2",
                    organization_id=1,
                    retention_days=90,
                    date_added=datetime.now(),
                    last_seen=datetime.now(),
                ),
                SpannerIndexerModel(
                    id=(uuid.uuid4().int & (1 << 64) - 1) >> 1,
                    decoded_id=12345,
                    string="string 3",
                    organization_id=1,
                    retention_days=90,
                    date_added=datetime.now(),
                    last_seen=datetime.now(),
                ),
            ],
            id="mutation multi write",
        ),
        pytest.param(
            CloudSpannerInsertMode.DML,
            [
                SpannerIndexerModel(
                    id=(uuid.uuid4().int & (1 << 64) - 1) >> 1,
                    decoded_id=12345,
                    string="string 11",
                    organization_id=1,
                    retention_days=90,
                    date_added=datetime.now(),
                    last_seen=datetime.now(),
                )
            ],
            id="dml single write",
        ),
        pytest.param(
            CloudSpannerInsertMode.DML,
            [
                SpannerIndexerModel(
                    id=(uuid.uuid4().int & (1 << 64) - 1) >> 1,
                    decoded_id=12345,
                    string="string 12",
                    organization_id=1,
                    retention_days=90,
                    date_added=datetime.now(),
                    last_seen=datetime.now(),
                ),
                SpannerIndexerModel(
                    id=(uuid.uuid4().int & (1 << 64) - 1) >> 1,
                    decoded_id=12345,
                    string="string 13",
                    organization_id=1,
                    retention_days=90,
                    date_added=datetime.now(),
                    last_seen=datetime.now(),
                ),
                SpannerIndexerModel(
                    id=(uuid.uuid4().int & (1 << 64) - 1) >> 1,
                    decoded_id=12345,
                    string="string 14",
                    organization_id=1,
                    retention_days=90,
                    date_added=datetime.now(),
                    last_seen=datetime.now(),
                ),
            ],
            id="dml multi write",
        ),
    ],
)
def test_spanner_indexer_write(mode: CloudSpannerInsertMode, models: Sequence[SpannerIndexerModel]):
    # TODO: Provide instance_id and database_id when running the test
    spanner_indexer = CloudSpannerIndexer(
        instance_id="", database_id="")
    spanner_indexer.validate()

    writer = CloudSpannerDBAccessor(spanner_indexer.database,
                                "perfstringindexer", mode)
    try:
        writer.insert(models)
    except Exception as exc:
        assert False, f"spanner writer raised an exception {exc} for {mode}"