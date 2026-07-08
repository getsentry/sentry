from sentry.issues.formatting.adapter import event_response_to_model


def _serialized_event() -> dict:
    return {
        "id": "abc123",
        "eventID": "abc123",
        "title": "ValueError: boom",
        "platform": "python",
        "dateCreated": "2024-01-01T00:00:00Z",
        "user": {"id": "1", "email": "user@example.com", "ipAddress": "1.2.3.4"},
        "contexts": {"browser": {"name": "Firefox"}},
        "tags": [
            {"key": "environment", "value": "prod"},
            {"key": "transaction", "value": "/checkout"},
        ],
        "entries": [
            {
                "type": "exception",
                "data": {
                    "values": [
                        {
                            "type": "ValueError",
                            "value": "boom",
                            "mechanism": {"handled": False},
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "do_thing",
                                        "filename": "app.py",
                                        "absPath": "/srv/app.py",
                                        "lineNo": 42,
                                        "colNo": 5,
                                        "inApp": True,
                                        "context": [[42, "raise ValueError('boom')"]],
                                    }
                                ]
                            },
                        }
                    ]
                },
            },
            {
                "type": "breadcrumbs",
                "data": {"values": [{"type": "log", "category": "app", "message": "started"}]},
            },
            {
                "type": "request",
                "data": {"method": "GET", "url": "https://x.com", "data": {"q": 1}},
            },
            {"type": "message", "data": {"formatted": "boom happened"}},
            {
                "type": "spans",
                "data": [{"op": "db", "description": "SELECT 1", "exclusiveTime": 12.5}],
            },
        ],
    }


def test_maps_event_level_fields() -> None:
    m = event_response_to_model(_serialized_event())
    assert m.event_id == "abc123"
    assert m.title == "ValueError: boom"
    assert m.platform == "python"
    assert m.message == "boom happened"
    assert m.transaction_name == "/checkout"
    assert m.contexts == {"browser": {"name": "Firefox"}}


def test_maps_camelcase_frame_and_handled_flag() -> None:
    m = event_response_to_model(_serialized_event())
    exc = m.exceptions[0]
    assert exc.type == "ValueError"
    assert exc.is_handled is False  # from mechanism.handled
    frame = exc.stacktrace.frames[0]
    assert frame.line_no == 42  # lineNo -> line_no
    assert frame.col_no == 5  # colNo -> col_no
    assert frame.abs_path == "/srv/app.py"  # absPath -> abs_path
    assert frame.in_app is True  # inApp -> in_app


def test_maps_breadcrumbs_request_spans_user_tags() -> None:
    m = event_response_to_model(_serialized_event())
    assert m.breadcrumbs[0].message == "started"
    assert m.request.method == "GET"
    assert m.spans[0].exclusive_time_ms == 12.5  # exclusiveTime -> exclusive_time_ms
    assert m.user.email == "user@example.com"
    assert m.user.ip_address == "1.2.3.4"  # ipAddress -> ip_address
    assert ("environment", "prod") in m.tags


def test_no_truncation_in_adapter() -> None:
    # adapter is pure mapping: all breadcrumbs come through, capping is a render concern
    data = _serialized_event()
    data["entries"].append(
        {
            "type": "breadcrumbs",
            "data": {"values": [{"message": str(i)} for i in range(50)]},
        }
    )
    # note: later entry of same type wins, so this replaces the earlier breadcrumbs entry
    m = event_response_to_model(data)
    assert len(m.breadcrumbs) == 50


def test_minimal_and_malformed_input_do_not_crash() -> None:
    # only a title
    assert event_response_to_model({"title": "t"}).title == "t"
    # missing title falls back to empty string (model requires the field)
    assert event_response_to_model({}).title == ""
    # malformed entries / values are skipped, not raised
    bad = {
        "title": "t",
        "entries": [
            {"type": "exception", "data": {"values": ["not-a-dict", {"type": "X"}]}},
            "not-an-entry",
        ],
        "tags": ["not-a-tag", {"key": "ok", "value": "v"}],
        "user": "not-a-dict",
    }
    m = event_response_to_model(bad)
    assert [e.type for e in m.exceptions] == ["X"]
    assert m.tags == [("ok", "v")]
    assert m.user is None
