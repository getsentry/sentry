import random
import string

import pytest
from google.cloud import spanner

from sentry.sentry_metrics.configuration import UseCaseKey
from sentry.sentry_metrics.indexer.cloudspanner.cloudspanner import \
    CloudSpannerIndexer, IdCodec, RawCloudSpannerIndexer
from sentry.sentry_metrics.indexer.id_generator import get_id


@pytest.mark.parametrize(
    "value",
    (
            12345,
            0,  # smallest supported id
            2 ** 63 - 1,  # largest supported id
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
    span_indexer.setup()
    span_indexer.validate()


def get_random_string(length: int) -> str:
    return "".join(random.choice(string.ascii_letters) for _ in range(length))


def test_spanner_indexer_implementation_basic():
    """
    Test the basic implementation of the CloudSpannerIndexer by performing a
    bulk record operation and then a resolve and reverse resolve operation.
    """
    indexer = RawCloudSpannerIndexer(instance_id="markus-test-spanner-pg",
                                     database_id="nikhar-test",
                                     table_name="perfstringindexer_v2",
                                     unique_organization_string_index="unique_organization_string_index")
    indexer.validate()
    codec = IdCodec()

    record = {"org_id": 55555, "string": get_random_string(10)}
    indexer.record(use_case_id=UseCaseKey.PERFORMANCE, org_id=record["org_id"],
                   string=record["string"])

    with indexer.database.snapshot() as snapshot:
        result = snapshot.read(indexer._table_name,
                               columns=["id"],
                               keyset=spanner.KeySet(keys=[[record["org_id"],
                                                      record["string"]]]),
                               index=indexer._unique_organization_string_index)

    all_results = list(result)
    encoded_id = all_results[0][0]
    decoded_id = codec.decode(all_results[0][0])
    assert len(all_results) == 1

    indexer_resolved_id = indexer.resolve(use_case_id=UseCaseKey.PERFORMANCE,
                              org_id=record["org_id"], string=record["string"])
    assert indexer_resolved_id is not None
    assert indexer_resolved_id == decoded_id

    indexer_reverse_resolved_string = indexer.reverse_resolve(use_case_id=UseCaseKey.PERFORMANCE,
                                      id=encoded_id)
    assert indexer_reverse_resolved_string is not None
    assert indexer_reverse_resolved_string == record["string"]
