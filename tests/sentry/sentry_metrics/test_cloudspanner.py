import random
import string
from datetime import datetime
from unittest.mock import patch

import pytest
from google.cloud import spanner

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.base import KeyResult, KeyResults
from sentry.sentry_metrics.indexer.cloudspanner.cloudspanner import (
    CloudSpannerIndexer,
    IdCodec,
    RawCloudSpannerIndexer,
    SpannerIndexerModel,
)
from sentry.sentry_metrics.indexer.id_generator import get_id


@pytest.fixture(scope="module")
def testing_indexer():
    indexer = RawCloudSpannerIndexer(instance_id="", database_id="")

    indexer.validate()
    return indexer


@pytest.mark.parametrize(
    "value",
    (
        12345,
        0,  # smallest supported id
        2**63 - 1,  # largest supported id
        get_id(),  # randomly generated id
    ),
)
def test_id_codec(value) -> None:
    codec = IdCodec()
    encoded = codec.encode(value)
    # Ensure it is in allowed range
    assert encoded >= -9223372036854775808
    assert encoded <= 9223372036854775807

    assert value == codec.decode(encoded)


@pytest.mark.skip(reason="TODO: Implement it correctly")
def test_spanner_indexer_service():
    # TODO: Provide instance_id and database_id when running the test
    span_indexer = CloudSpannerIndexer(instance_id="", database_id="")
    span_indexer.validate()


def get_random_string(length: int) -> str:
    return "".join(random.choice(string.ascii_letters) for _ in range(length))


@pytest.mark.skip(reason="TODO: Implement it correctly")
def test_spanner_indexer_implementation_basic(testing_indexer):
    """
    Test the basic implementation of the CloudSpannerIndexer by performing a
    bulk record operation and then perform a resolve and reverse resolve
    operation and validate the record.
    """
    codec = IdCodec()

    record = {"org_id": 55555, "string": get_random_string(10)}
    testing_indexer.record(
        use_case_id=UseCaseKey.PERFORMANCE, org_id=record["org_id"], string=record["string"]
    )

    with testing_indexer.database.snapshot() as snapshot:
        result = snapshot.read(
            testing_indexer._get_table_name(UseCaseKey.PERFORMANCE),
            columns=["id"],
            keyset=spanner.KeySet(keys=[[record["org_id"], record["string"]]]),
            index=testing_indexer._get_unique_org_string_index_name(UseCaseKey.PERFORMANCE),
        )

    all_results = list(result)
    encoded_id = all_results[0][0]
    decoded_id = codec.decode(all_results[0][0])
    assert len(all_results) == 1

    indexer_resolved_id = testing_indexer.resolve(
        use_case_id=UseCaseKey.PERFORMANCE, org_id=record["org_id"], string=record["string"]
    )
    assert indexer_resolved_id is not None
    assert indexer_resolved_id == decoded_id

    indexer_reverse_resolved_string = testing_indexer.reverse_resolve(
        use_case_id=UseCaseKey.PERFORMANCE, id=encoded_id
    )
    assert indexer_reverse_resolved_string is not None
    assert indexer_reverse_resolved_string == record["string"]


@pytest.mark.skip(reason="TODO: Implement it correctly")
def test_spanner_indexer_implementation_bulk_insert_twice_gives_same_result(testing_indexer):
    """
    When performing a record operation twice (in separate transactions),
    the result returned should be the same since the record is fetched from
    the database.
    """
    record = {"org_id": 55555, "string": get_random_string(10)}
    record1_int = testing_indexer.record(
        use_case_id=UseCaseKey.PERFORMANCE, org_id=record["org_id"], string=record["string"]
    )

    # Insert the record again to validate that the returned id is the one we
    # got from the first insert.
    record2_int = testing_indexer.record(
        use_case_id=UseCaseKey.PERFORMANCE, org_id=record["org_id"], string=record["string"]
    )

    assert record1_int == record2_int


@patch(
    "sentry.sentry_metrics.indexer.cloudspanner.cloudspanner.RawCloudSpannerIndexer._insert_collisions_handled"
)
@pytest.mark.skip(reason="TODO: Implement it correctly")
def test_spanner_indexer_insert_batch_no_conflict_does_not_trigger_individual_inserts(
    mock, testing_indexer
):
    """
    Test that when a record already exists in the database, the individual insert
    api is called.
    """
    codec = IdCodec()

    model1_id = get_id()
    key_results1 = KeyResults()
    model1 = SpannerIndexerModel(
        id=codec.encode(model1_id),
        decoded_id=model1_id,
        string=get_random_string(10),
        organization_id=55555,
        date_added=datetime.now(),
        last_seen=datetime.now(),
        retention_days=55,
    )
    testing_indexer._insert_db_records(UseCaseKey.PERFORMANCE, [model1], key_results1)

    # Insert the same record with a different id but the key result would
    # have the id of model1.
    key_results2 = KeyResults()
    model2_id = get_id()
    model2 = SpannerIndexerModel(
        id=codec.encode(model2_id),
        decoded_id=model2_id,
        string=get_random_string(10),
        organization_id=55556,
        date_added=datetime.now(),
        last_seen=datetime.now(),
        retention_days=55,
    )
    testing_indexer._insert_db_records(UseCaseKey.PERFORMANCE, [model2], key_results2)
    assert mock.call_count == 0, "Insert with collisions should not be called"


@patch(
    "sentry.sentry_metrics.indexer.cloudspanner.cloudspanner.RawCloudSpannerIndexer._insert_collisions_handled"
)
@pytest.mark.skip(reason="TODO: Implement it correctly")
def test_spanner_indexer_insert_batch_conflict_triggers_individual_transactions(
    mock, testing_indexer
):
    """
    Test that when a record already exists in the database, the individual insert
    api is called.
    """
    codec = IdCodec()
    indexed_string = get_random_string(10)

    model1_id = get_id()
    key_results1 = KeyResults()
    model1 = SpannerIndexerModel(
        id=codec.encode(model1_id),
        decoded_id=model1_id,
        string=indexed_string,
        organization_id=55555,
        date_added=datetime.now(),
        last_seen=datetime.now(),
        retention_days=55,
    )
    testing_indexer._insert_db_records(UseCaseKey.PERFORMANCE, [model1], key_results1)

    # Insert the same record with a different id but the key result would
    # have the id of model1.
    key_results2 = KeyResults()
    model2_id = get_id()
    model2 = SpannerIndexerModel(
        id=codec.encode(model2_id),
        decoded_id=model2_id,
        string=indexed_string,
        organization_id=55555,
        date_added=datetime.now(),
        last_seen=datetime.now(),
        retention_days=55,
    )
    testing_indexer._insert_db_records(UseCaseKey.PERFORMANCE, [model2], key_results2)
    assert mock.call_count == 1, "Insert with collisions should be called"


@pytest.mark.skip(reason="TODO: Implement it correctly")
def test_spanner_indexer_individual_insert(testing_indexer):
    """
    Test that when a record already exists in the database, trying to insert
    a record with the same org_id and string (but different id) will return the
    existing id from the database and not the id of the duplicate record
    which is being inserted.
    """
    codec = IdCodec()
    indexed_string = get_random_string(10)

    model1_id = get_id()
    expected_key_result = KeyResults()
    expected_key_result.add_key_result(KeyResult(org_id=55555, string=indexed_string, id=model1_id))
    key_results1 = KeyResults()
    model1 = SpannerIndexerModel(
        id=codec.encode(model1_id),
        decoded_id=model1_id,
        string=indexed_string,
        organization_id=55555,
        date_added=datetime.now(),
        last_seen=datetime.now(),
        retention_days=55,
    )
    testing_indexer._insert_collisions_handled(UseCaseKey.PERFORMANCE, [model1], key_results1)
    assert (
        key_results1.get_mapped_key_strings_to_ints()
        == expected_key_result.get_mapped_key_strings_to_ints()
    )

    # Insert the same record with a different id but the key result would
    # have the id of model1.
    key_results2 = KeyResults()
    model2_id = get_id()
    model2 = SpannerIndexerModel(
        id=codec.encode(model2_id),
        decoded_id=model2_id,
        string=indexed_string,
        organization_id=55555,
        date_added=datetime.now(),
        last_seen=datetime.now(),
        retention_days=55,
    )
    testing_indexer._insert_collisions_handled(UseCaseKey.PERFORMANCE, [model2], key_results2)
    assert (
        key_results2.get_mapped_key_strings_to_ints()
        == expected_key_result.get_mapped_key_strings_to_ints()
    )
