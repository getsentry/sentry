from sentry.sentry_metrics.querying.metadata.metrics import _flatten, _reverse_mapping


def test_reverse_mapping():
    project_id_to_mris = {
        1: ["metric1", "metric2", "metric3"],
        2: ["metric1", "metric4", "metric5", "metric6"],
        3: ["metric1", "metric6"],
    }
    expected = {
        "metric1": [1, 2, 3],
        "metric2": [1],
        "metric3": [1],
        "metric4": [2],
        "metric5": [2],
        "metric6": [2, 3],
    }

    assert _reverse_mapping(project_id_to_mris) == expected


def test_flatten():
    list_of_lists = [[1, 2, 3], [4, 5, 6], [3, 6, 8]]
    expected = [1, 2, 3, 4, 5, 6, 3, 6, 8]
    assert _flatten(list_of_lists) == expected
