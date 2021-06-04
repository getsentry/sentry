from sentry.killswitches import _value_matches, normalize_value


def test_normalize_value():
    assert normalize_value("store.load-shed-group-creation-projects", [1, 2, 3]) == [
        {"project_id": "1"},
        {"project_id": "2"},
        {"project_id": "3"},
    ]

    assert normalize_value("store.load-shed-group-creation-projects", [{"project_id": 123}]) == [
        {"project_id": "123"},
    ]


def test_value_matches():
    assert _value_matches(
        "store.load-shed-group-creation-projects",
        [
            {"project_id": "1"},
            {"project_id": "2"},
            {"project_id": "3"},
        ],
        {"project_id": 2},
    )

    assert _value_matches(
        "store.load-shed-group-creation-projects",
        [
            {"project_id": 1},
            {"project_id": 2},
            {"project_id": 3},
        ],
        {"project_id": 2},
    )

    assert not _value_matches(
        "store.load-shed-group-creation-projects",
        [
            {"project_id": "1"},
            {"project_id": "2"},
            {"project_id": "3"},
        ],
        {"project_id": 4},
    )

    assert not _value_matches("store.load-shed-group-creation-projects", [], {"project_id": 3})

    assert not _value_matches("store.load-shed-group-creation-projects", [{}], {"project_id": 3})

    assert not _value_matches(
        "store.load-shed-group-creation-projects",
        [
            {"project_id": "1"},
            {"project_id": "2"},
            {"project_id": "3"},
        ],
        {},
    )

    assert not _value_matches(
        "store.load-shed-group-creation-projects", [{"project_id": None}], {"project_id": 3}
    )  # type: ignore

    assert _value_matches(
        "store.load-shed-group-creation-projects",
        [{"event_type": "transaction"}],
        {"project_id": 3, "event_type": "transaction"},
    )
