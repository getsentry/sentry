from sentry.sentry_metrics.querying.metadata.metrics import _convert_to_mris_to_project_ids_mapping


def test_convert_to_mris_to_project_ids_mapping():
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

    assert _convert_to_mris_to_project_ids_mapping(project_id_to_mris) == expected
