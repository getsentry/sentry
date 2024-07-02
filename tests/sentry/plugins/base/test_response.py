import datetime

from sentry.plugins.base.response import JSONResponse


def test_json_response():
    resp = JSONResponse({}).respond(None)
    assert resp.status_code == 200


def test_json_response_with_status_kwarg():
    resp = JSONResponse({}, status=400).respond(None)
    assert resp.status_code == 400


def test_json_response_with_weird_inputs():
    # This test is required for validating orjson serializing/deserializing.
    date = datetime.datetime(2017, 1, 20, 21, 39, 23, 30723, tzinfo=datetime.UTC)
    date_resp = JSONResponse({"date": date}).respond(None)
    assert date_resp.status_code == 200
    assert date_resp.content.decode() == '{"date":"2017-01-20T21:39:23.030723Z"}'

    non_str_key_resp = JSONResponse({1: "non-str-key-value"}).respond(None)
    assert non_str_key_resp.status_code == 200
    assert non_str_key_resp.content.decode() == '{"1":"non-str-key-value"}'
