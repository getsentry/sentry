from sentry.killswitches import _normalize_value, _value_matches


def test_normalize_value():
    assert _normalize_value([1, 2, 3]) == {"project_id": ["1", "2", "3"]}


def test_value_matches():
    assert _value_matches({"project_id": ["1", "2", "3"]}, {"project_id": 2})
    assert not _value_matches({"project_id": ["1", "2", "3"]}, {"project_id": 4})
    assert not _value_matches({}, {"project_id": 3})
    assert not _value_matches({"project_id": ["1", "2", "3"]}, {})
    assert not _value_matches({"project_id": None}, {"project_id": 3})
    assert not _value_matches({"project_id": []}, {"project_id": 3})

    assert _value_matches(
        {"event_type": ["transaction"]}, {"project_id": 3, "event_type": "transaction"}
    )
