import datetime

from sentry.sentry_metrics.indexer.cloudspanner_model import SpannerIndexerModel


def test_cloudspanner_model_column_format_dml():
    assert SpannerIndexerModel.to_columns_format_dml() == '(id, string, organization_id, date_added, last_seen, retention_days)'


def test_cloudspanner_model_column_format_batch():
    assert SpannerIndexerModel.to_columns_format_batch() == ["id", "string", "organization_id", "date_added", "last_seen", "retention_days"]


def test_cloudspanner_model_value_format():
    now = datetime.datetime.now()
    now_str = now.strftime("%Y-%m-%d %H:%M:%S %Z")
    model = SpannerIndexerModel(id=10000, string="string",
                                organization_id=20000,
                                date_added=now,
                                last_seen=now, retention_days=90)
    assert model.to_values_format_dml() == f"(10000, \"string\", 20000, " \
                                           f"'{now_str}', " \
                                           f"'{now_str}', 90)"

