from __future__ import annotations

import os
from collections.abc import Iterable, MutableMapping
from os import path
from typing import Any
from unittest import mock

import orjson
import pytest
from django.utils.functional import cached_property

from sentry import eventstore
from sentry.conf.server import DEFAULT_GROUPING_CONFIG
from sentry.event_manager import EventManager, get_event_type, materialize_metadata
from sentry.eventstore.models import Event
from sentry.grouping.api import (
    GroupingConfig,
    apply_server_side_fingerprinting,
    get_default_grouping_config_dict,
    load_grouping_config,
)
from sentry.grouping.component import BaseGroupingComponent
from sentry.grouping.enhancer import Enhancements
from sentry.grouping.fingerprinting import FingerprintingRules
from sentry.grouping.strategies.configurations import (
    GROUPING_CONFIG_CLASSES,
    register_grouping_config,
)
from sentry.grouping.variants import BaseVariant
from sentry.models.project import Project
from sentry.stacktraces.processing import normalize_stacktraces_for_grouping
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.utils import json

GROUPING_INPUTS_DIR = path.join(path.dirname(__file__), "grouping_inputs")
FINGERPRINT_INPUTS_DIR = path.join(path.dirname(__file__), "fingerprint_inputs")

MANUAL_SAVE_CONFIGS = set(GROUPING_CONFIG_CLASSES.keys()) - {DEFAULT_GROUPING_CONFIG}
FULL_PIPELINE_CONFIGS = {DEFAULT_GROUPING_CONFIG}

# When regenerating snapshots locally, you can set `SENTRY_SNAPSHOTS_WRITEBACK=1` and
# `SENTRY_FAST_GROUPING_SNAPSHOTS=1` in the environment to update snapshots automatically and run
# all snapshots through the faster, non-DB-involving process.
if os.environ.get("SENTRY_FAST_GROUPING_SNAPSHOTS") and not os.environ.get("GITHUB_ACTIONS"):
    FULL_PIPELINE_CONFIGS.remove(DEFAULT_GROUPING_CONFIG)
    MANUAL_SAVE_CONFIGS.add(DEFAULT_GROUPING_CONFIG)

# Create a grouping config to be used only in tests, in which message parameterization is turned
# off. This lets us easily force an event to have different hashes for different configs. (We use a
# purposefully old date so that it can be used as a secondary config.)
#
# Note: This must be registered after `MANUAL_SAVE_CONFIGS` is defined, so that
# `MANUAL_SAVE_CONFIGS` doesn't include it.
NO_MSG_PARAM_CONFIG = "no-msg-param-tests-only:2012-12-31"
register_grouping_config(
    id=NO_MSG_PARAM_CONFIG,
    base=DEFAULT_GROUPING_CONFIG,
    initial_context={"normalize_message": False},
)


class GroupingInput:
    def __init__(self, inputs_dir: str, filename: str):
        self.filename = filename  # Necessary for test naming
        with open(path.join(inputs_dir, self.filename)) as f:
            self.data = json.load(f)

    def _manually_save_event(
        self, grouping_config: GroupingConfig, fingerprinting_config: FingerprintingRules
    ) -> Event:
        """
        Manually complete the steps to save an event, in such a way as to not touch postgres (which
        makes it run a lot faster).
        """
        mgr = EventManager(data=self.data, grouping_config=grouping_config)
        mgr.normalize()
        data = mgr.get_data()

        # Normalize the stacktrace for grouping.  This normally happens in `EventManager.save`.
        normalize_stacktraces_for_grouping(data, load_grouping_config(grouping_config))

        data.setdefault("fingerprint", ["{{ default }}"])
        apply_server_side_fingerprinting(data, fingerprinting_config)
        event_type = get_event_type(data)
        event_metadata = event_type.get_metadata(data)
        data.update(materialize_metadata(data, event_type, event_metadata))

        return eventstore.backend.create_event(project_id=1, data=data)

    def _save_event_with_pipeline(
        self,
        grouping_config: GroupingConfig,
        fingerprinting_config: FingerprintingRules,
        project: Project,
    ) -> Event:
        with (
            mock.patch(
                "sentry.grouping.ingest.hashing.get_grouping_config_dict_for_project",
                return_value=grouping_config,
            ),
            mock.patch(
                "sentry.grouping.ingest.hashing.get_fingerprinting_config_for_project",
                return_value=fingerprinting_config,
            ),
        ):
            return save_new_event(self.data, project)

    def create_event(
        self,
        config_name: str,
        use_full_ingest_pipeline: bool = True,
        project: Project | None = None,
    ) -> Event:
        grouping_config = get_default_grouping_config_dict(config_name)

        # Add in any extra grouping configuration from the input data
        grouping_config["enhancements"] = Enhancements.from_rules_text(
            self.data.get("_grouping", {}).get("enhancements", ""),
            bases=Enhancements.from_base64_string(grouping_config["enhancements"]).bases,
        ).base64_string
        fingerprinting_config = FingerprintingRules.from_json(
            {"rules": self.data.get("_fingerprinting_rules", [])},
            bases=GROUPING_CONFIG_CLASSES[config_name].fingerprinting_bases,
        )

        if use_full_ingest_pipeline:
            assert project, "'project' is required to use full pipeline"
            event = self._save_event_with_pipeline(grouping_config, fingerprinting_config, project)
        else:
            event = self._manually_save_event(grouping_config, fingerprinting_config)

        return event


def get_grouping_inputs(inputs_dir: str) -> list[GroupingInput]:
    return [
        GroupingInput(inputs_dir, filename)
        for filename in sorted(os.listdir(inputs_dir))
        if filename.endswith(".json")
    ]


def with_grouping_inputs(test_param_name: str, inputs_dir: str) -> pytest.MarkDecorator:
    grouping_inputs = get_grouping_inputs(inputs_dir)
    return pytest.mark.parametrize(
        test_param_name,
        grouping_inputs,
        ids=lambda grouping_input: grouping_input.filename.replace("-", "_").replace(".json", ""),
    )


def with_grouping_configs(config_ids: Iterable[str]) -> pytest.MarkDecorator:
    if not config_ids:
        return pytest.mark.skip("no configs to test")

    return pytest.mark.parametrize(
        "config_name", config_ids, ids=lambda config_name: config_name.replace("-", "_")
    )


class FingerprintInput:
    def __init__(self, filename: str) -> None:
        self.filename = filename

    @cached_property
    def data(self) -> MutableMapping[str, Any]:
        with open(path.join(FINGERPRINT_INPUTS_DIR, self.filename)) as f:
            return json.load(f)

    def create_event(self) -> tuple[FingerprintingRules, Event]:
        config = FingerprintingRules.from_json(
            {"rules": self.data.get("_fingerprinting_rules", [])},
            bases=GROUPING_CONFIG_CLASSES[DEFAULT_GROUPING_CONFIG].fingerprinting_bases,
        )
        mgr = EventManager(data=self.data)
        mgr.normalize()
        data = mgr.get_data()

        data.setdefault("fingerprint", ["{{ default }}"])
        apply_server_side_fingerprinting(data, config)
        event_type = get_event_type(data)
        event_metadata = event_type.get_metadata(data)
        data.update(materialize_metadata(data, event_type, event_metadata))

        evt = eventstore.backend.create_event(project_id=1, data=data)
        return config, evt


fingerprint_input = list(
    FingerprintInput(filename)
    for filename in os.listdir(FINGERPRINT_INPUTS_DIR)
    if filename.endswith(".json")
)


def with_fingerprint_input(name: str) -> pytest.MarkDecorator:
    return pytest.mark.parametrize(
        name, fingerprint_input, ids=lambda x: x.filename[:-5].replace("-", "_")
    )


def to_json(value: Any, pretty_print: bool = False) -> str:
    option = orjson.OPT_SORT_KEYS
    if pretty_print:
        option = option | orjson.OPT_INDENT_2

    return orjson.dumps(value, option=option).decode()


def dump_variant(
    variant: BaseVariant,
    lines: list[str],
    indent: int = 0,
    include_non_contributing: bool = True,
) -> list[str]:
    def _dump_component(
        component: BaseGroupingComponent[str | int | BaseGroupingComponent[Any]], indent: int
    ) -> None:
        if not component.hint and not component.values:
            return
        if component.contributes or include_non_contributing:
            lines.append(
                "%s%s%s%s"
                % (
                    "  " * indent,
                    component.id,
                    component.contributes and "*" or "",
                    component.hint and " (%s)" % component.hint or "",
                )
            )
            for value in component.values:
                if isinstance(value, BaseGroupingComponent):
                    _dump_component(value, indent + 1)
                else:
                    lines.append("{}{}".format("  " * (indent + 1), to_json(value)))

    lines.append("{}hash: {}".format("  " * indent, to_json(variant.get_hash())))
    if hasattr(variant, "contributing_component"):
        contributing_component_id = (
            variant.contributing_component.id
            if variant.contributing_component is not None
            else to_json(None)
        )
        lines.append(
            "{}contributing component: {}".format("  " * indent, contributing_component_id)
        )

    # Note that this prints `__dict__`, not `as_dict()`, so if something seems missing, that's
    # probably why
    for key, value in sorted(variant.__dict__.items()):
        if key in ["config", "hash", "contributing_component", "variant_name"]:
            # We do not want to dump the config, and we've already dumped the hash and the
            # contributing component
            continue

        if isinstance(value, BaseGroupingComponent):
            lines.append("{}{}:".format("  " * indent, key))
            _dump_component(value, indent + 1)
        else:
            lines.append("{}{}: {}".format("  " * indent, key, to_json(value)))

    return lines


def get_snapshot_path(
    test_file: str, input_file: str, test_name: str, grouping_config_name: str
) -> str:
    """
    Get the path to the snapshot file. This mirrors the default behavior, but is useful if you want
    multiple tests' snapshots to wind up in the same folder, as might happen if different grouping
    configs are tested differently.
    """
    return path.join(
        path.dirname(test_file),
        "snapshots",
        path.basename(test_file).replace(".py", ""),
        test_name,
        grouping_config_name.replace("-", "_").replace(":", "@"),
        input_file.replace("-", "_").replace(".json", ".pysnap"),
    )
