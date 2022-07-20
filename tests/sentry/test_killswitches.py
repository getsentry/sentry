from sentry.killswitches import _value_matches, normalize_value


def test_normalize_value():
    assert normalize_value("store.load-shed-group-creation-projects", [1, 2, 3]) == [
        {"project_id": "1", "platform": None},
        {"project_id": "2", "platform": None},
        {"project_id": "3", "platform": None},
    ]

    assert normalize_value("store.load-shed-group-creation-projects", [{"project_id": 123}]) == [
        {"project_id": "123", "platform": None},  # match any platform
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
    assert not _value_matches(
        "store.load-shed-group-creation-projects",
        [{"project_id": 2, "platform": None}],
        {"project_id": 3},
    )

    assert not _value_matches(
        "store.load-shed-group-creation-projects",
        [
            {"project_id": "1"},
            {"project_id": "2"},
            {"project_id": "3"},
        ],
        {},
    )

    for conditions in [
        [{}],  # [{}] corresponds to any([all([])]), which is True
        [{"project_id": None}],
        [{"project_id": None, "platform": None}],
        [{"project_id": 3, "platform": None, "event_type": None}],
    ]:
        assert _value_matches(
            "store.load-shed-group-creation-projects", conditions, {"project_id": 3}
        )  # type: ignore

    assert _value_matches(
        "store.load-shed-group-creation-projects",
        [{"project_id": 3, "platform": None}],
        {"project_id": 3},
    )  # type: ignore

    assert _value_matches(
        "store.load-shed-group-creation-projects",
        [{"event_type": "transaction"}],
        {"project_id": 3, "event_type": "transaction"},
    )
