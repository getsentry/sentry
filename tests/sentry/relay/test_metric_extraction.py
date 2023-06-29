from sentry.relay.config.metric_extraction import _convert_alert_query_to_condition


def test_empty_condition():
    actual = _convert_alert_query_to_condition("")

    assert actual == {"op": "and", "inner": []}


def test_simple_condition():
    actual = _convert_alert_query_to_condition("transaction.duration:>=1000")

    assert actual == {"name": "event.duration", "op": "gte", "value": 1000.0}


def test_or_boolean_condition():
    actual = _convert_alert_query_to_condition(
        "transaction.duration:>=100 OR transaction.duration:<1000"
    )

    expected = {
        "op": "or",
        "inner": [
            {"name": "event.duration", "op": "gte", "value": 100.0},
            {"name": "event.duration", "op": "lt", "value": 1000.0},
        ],
    }

    assert actual == expected


def test_and_boolean_condition():
    actual = _convert_alert_query_to_condition("release:foo transaction.duration:<10s")

    expected = {
        "op": "and",
        "inner": [
            {"name": "event.release", "op": "in", "value": ["foo"]},
            {"name": "event.duration", "op": "lt", "value": 10000.0},
        ],
    }

    assert actual == expected


def test_complex_and_condition():
    query = "geo.country_code:=AT http.method:=GET release:=a transaction.op:=b transaction.status:=aborted transaction.duration:>1s"
    actual = _convert_alert_query_to_condition(query)

    expected = {
        "inner": [
            {"name": "event.geo.country_code", "op": "eq", "value": "AT"},
            {"name": "event.http.method", "op": "eq", "value": "GET"},
            {"name": "event.release", "op": "in", "value": ["a"]},
            {"name": "event.transaction.op", "op": "eq", "value": "b"},
            {"name": "event.transaction.status", "op": "eq", "value": 10},
            {"name": "event.duration", "op": "gt", "value": 10.0},
        ],
        "op": "and",
    }

    assert actual == expected
