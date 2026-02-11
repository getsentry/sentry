from __future__ import annotations

from typing import Any

from sentry.conf.server import DEFAULT_GROUPING_CONFIG
from sentry.grouping.api import _load_default_grouping_config
from sentry.grouping.grouping_info import get_grouping_info, get_grouping_info_from_variants
from sentry.grouping.variants import BaseVariant
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.pytest.fixtures import InstaSnapshotter
from tests.sentry.grouping import run_as_grouping_inputs_snapshot_test, to_json


@run_as_grouping_inputs_snapshot_test
def test_grouping_info(
    variants: dict[str, BaseVariant], create_snapshot: InstaSnapshotter, **kwargs: Any
) -> None:
    grouping_info = get_grouping_info_from_variants(variants)
    create_snapshot(to_json(grouping_info, pretty_print=True))


class GroupingInfoTest(TestCase):
    def test_get_grouping_info_error_event(self) -> None:
        default_grouping_config = _load_default_grouping_config()
        event = save_new_event({"message": "Dogs are great!"}, self.project)

        grouping_info = get_grouping_info(default_grouping_config, self.project, event)

        assert grouping_info["grouping_config"] == DEFAULT_GROUPING_CONFIG
        assert grouping_info["variants"]["message"]["type"] == "component"
        assert grouping_info["variants"]["message"]["description"] == "message"
        assert grouping_info["variants"]["message"]["component"]["contributes"] is True
        assert grouping_info["variants"]["message"]["key"] == "message"
        assert grouping_info["variants"]["message"]["contributes"] is True
