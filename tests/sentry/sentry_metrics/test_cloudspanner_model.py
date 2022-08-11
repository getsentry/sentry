import datetime

from sentry.sentry_metrics.indexer.cloudspanner_model import SpannerIndexerModel


def test_cloudspanner_model_column_format_dml():
    assert (
        SpannerIndexerModel.to_columns_format_dml()
        == "(id, decoded_id, string, organization_id, date_added, last_seen, "
        "retention_days)"
    )


def test_cloudspanner_model_column_format_batch():
    assert SpannerIndexerModel.to_columns_format_batch() == [
        "id",
        "decoded_id",
        "string",
        "organization_id",
        "date_added",
        "last_seen",
        "retention_days",
    ]


def test_cloudspanner_model_value_format():
    now = datetime.datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S %Z")
    model = SpannerIndexerModel(
        id=10000,
        decoded_id=12345,
        string="string",
        organization_id=20000,
        date_added=now,
        last_seen=now,
        retention_days=90,
    )
    assert model.to_values_format_dml() == "(10000, 12345, 'string', 20000, '{}', '{}', 90)".format(
        now_str, now_str
    )
