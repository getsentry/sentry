from sentry.grouping.result import _write_tree_labels


def test_write_none_tree_label():
    event_data = {}
    _write_tree_labels([None], event_data)
    assert event_data["hierarchical_tree_labels"] == [None]
