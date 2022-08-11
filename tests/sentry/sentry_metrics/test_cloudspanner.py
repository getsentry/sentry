import datetime
import uuid

import pytest

from sentry.sentry_metrics.indexer.cloudspanner import CloudSpannerIndexer
from sentry.sentry_metrics.indexer.cloudspanner_model import SpannerIndexerModel


@pytest.mark.skip(reason="TODO: Implement it correctly")
def test_spanner_indexer_service():
    # TODO: Provide instance_id and database_id when running the test
    span_indexer = CloudSpannerIndexer(instance_id="", database_id="")
    span_indexer.setup()
    span_indexer.validate()


@pytest.mark.skip(reason="TODO: Implement it correctly")
def test_spanner_indexer_write_dml():
    # TODO: Provide instance_id and database_id when running the test
    spanner_indexer = CloudSpannerIndexer(
        instance_id="", database_id="")
    spanner_indexer.validate()

    model = SpannerIndexerModel(
        id=(uuid.uuid4().int & (1 << 64) - 1) >> 1,
        decoded_id=12345,
        string="string",
        organization_id=1,
        date_added=datetime.datetime.now(),
        last_seen=datetime.datetime.now(),
        retention_days=90,
    )

    def insert_perfstringindexer(transaction):
        full_statememt = "INSERT INTO perfstringindexer %s VALUES %s" % (model.to_columns_format_dml(), model.to_values_format_dml())
        print(full_statememt)
        transaction.execute_update(full_statememt)

    spanner_indexer.database.run_in_transaction(insert_perfstringindexer)
