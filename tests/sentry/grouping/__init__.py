from __future__ import annotations

import functools
import os
from collections.abc import Callable, Iterable, MutableMapping
from os import path
from typing import Any
from unittest import mock

import orjson
import pytest
from django.utils.functional import cached_property

from sentry.conf.server import DEFAULT_GROUPING_CONFIG
from sentry.event_manager import EventManager, get_event_type, materialize_metadata
from sentry.grouping.api import (
    GroupingConfig,
    apply_server_side_fingerprinting,
    get_default_grouping_config_dict,
    load_grouping_config,
)
from sentry.grouping.component import BaseGroupingComponent
from sentry.grouping.enhancer import EnhancementsConfig
from sentry.grouping.fingerprinting import FingerprintingConfig
from sentry.grouping.strategies.configurations import (
    GROUPING_CONFIG_CLASSES,
    register_grouping_config,
)
from sentry.grouping.utils import expand_title_template
from sentry.grouping.variants import BaseVariant
from sentry.models.project import Project
from sentry.services import eventstore
from sentry.services.eventstore.models import Event
from sentry.stacktraces.processing import normalize_stacktraces_for_grouping
from sentry.testutils.factories import Factories
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.pytest.fixtures import InstaSnapshotter, django_db_all
from sentry.utils import json
from sentry.utils.safe import get_path

GROUPING_TESTS_DIR = path.dirname(__file__)
GROUPING_INPUTS_DIR = path.join(GROUPING_TESTS_DIR, "grouping_inputs")
FINGERPRINT_INPUTS_DIR = path.join(GROUPING_TESTS_DIR, "fingerprint_inputs")
SNAPSHOTS_DIR = path.join(GROUPING_TESTS_DIR, "snapshots")

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
        self, grouping_config: GroupingConfig, fingerprinting_config: FingerprintingConfig
    ) -> Event:
        """
        Manually complete the steps to save an event, in such a way as to not touch postgres (which
        makes it run a lot faster).
        """
        mgr = EventManager(data=self.data, grouping_config=grouping_config)
        mgr.normalize()
        data = mgr.get_data()

        # Before creating the event, manually run the parts of `EventManager.save` which are
        # necessary for grouping.

        normalize_stacktraces_for_grouping(data, load_grouping_config(grouping_config))

        data.setdefault("fingerprint", ["{{ default }}"])
        apply_server_side_fingerprinting(data, fingerprinting_config)
        fingerprint_info = data.get("_fingerprint_info", {})
        custom_title_template = get_path(fingerprint_info, "matched_rule", "attributes", "title")

        # Technically handling custom titles happens during grouping, not before it, but we're not
        # running grouping until later, and the title needs to be set before we get metadata below.
        if custom_title_template:
            resolved_title = expand_title_template(custom_title_template, data)
            data["title"] = resolved_title

        event_type = get_event_type(data)
        event_metadata = event_type.get_metadata(data)
        data.update(materialize_metadata(data, event_type, event_metadata))

        event = eventstore.backend.create_event(project_id=1, data=data)
        # Assigning the project after the fact also populates the cache, so that calls to
        # `event.project` don't fail. (If the `event.project` getter can't pull the project from the
        # cache it'll look in the database, but since this isn't a real project, that errors out.)
        event.project = mock.Mock(id=11211231)

        return event

    def _save_event_with_pipeline(
        self,
        grouping_config: GroupingConfig,
        fingerprinting_config: FingerprintingConfig,
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
        grouping_config["enhancements"] = EnhancementsConfig.from_rules_text(
            self.data.get("_grouping", {}).get("enhancements", ""),
            bases=EnhancementsConfig.from_base64_string(grouping_config["enhancements"]).bases,
        ).base64_string
        fingerprinting_config = FingerprintingConfig.from_json(
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
        "config_name", sorted(config_ids), ids=lambda config_name: config_name.replace("-", "_")
    )


def get_grouping_input_snapshotter(
    insta_snapshot: InstaSnapshotter,
    folder_name: str,
    test_name: str,
    config_name: str,
    grouping_input_file: str,
) -> InstaSnapshotter:
    """Create a snapshot function with the output path baked in."""
    snapshot_path = path.join(
        SNAPSHOTS_DIR,
        folder_name,
        test_name,
        # Windows paths contain colons, so we have to swap out the colons in our config names
        config_name.replace(":", "@"),
        grouping_input_file.replace(".json", ".pysnap"),
    )
    # Convert from JSON to Python file formatting
    snapshot_path = snapshot_path.replace("-", "_")

    snapshot_function = functools.partial(insta_snapshot, reference_file=snapshot_path)

    return snapshot_function


def run_as_grouping_inputs_snapshot_test(test_func: Callable[..., None]) -> Callable[..., None]:
    """
    Decorator which causes a test to be run against all of the inputs in `grouping_inputs`.

    Tests can be run using either the full `EventManager.save` pipeline, or a minimal (and much more
    performant) save process. Using the full save process is the most realistic way to test, but
    it's also slow, because it comes with the overhead of our full postgres database. Manually
    cherry-picking only certain parts of the save process to run is much faster, but it's also more
    likely to fall out of sync with reality.

    We therefore use the full process when testing the current grouping config, and only use the
    faster manual process for older configs. When testing locally, the faster process can be used
    for all configs by setting `SENTRY_FAST_GROUPING_SNAPSHOTS=1` in the environment.

    Basic usage:

        @run_as_grouping_inputs_snapshot_test
        def test_some_grouping_thing(
            event: Event,
            variants: dict[str, BaseVariant],
            config_name: str,
            create_snapshot: InstaSnapshotter,
            **kwargs: Any,
        )-> None:
            # In this section, make any necessary assertions about the event and/or variants, and
            # process them to create snapshot output

            create_snapshot(output)

    When the wrapped test function is called, all arguments are passed as keywords, so any which
    aren't used can be absorbed into kwargs:

        @run_as_grouping_inputs_snapshot_test
        def test_some_grouping_thing(
            variants: dict[str, BaseVariant],
            create_snapshot: InstaSnapshotter,
            **kwargs: Any,
        )-> None:
            # ...

    If more mocking is necessary, it can be done alongside this decorator:

        @run_as_grouping_inputs_snapshot_test
        @patch("sentry.grouping.strategies.newstyle.logging.exception")
        def test_variants(
            mock_exception_logger: MagicMock,
            event: Event,
            variants: dict[str, BaseVariant],
            config_name: str,
            create_snapshot: InstaSnapshotter,
            **kwargs: Any,
        ) -> None:
            # ...

    Note that because pytest adds in mocks as args rather than kwargs, the new mocks need to go at
    the beginning of the test function's argument list (which in turn means the patching needs to go
    underneath this decorator).
    """

    @django_db_all
    @with_grouping_inputs("grouping_input", GROUPING_INPUTS_DIR)
    @with_grouping_configs(MANUAL_SAVE_CONFIGS | FULL_PIPELINE_CONFIGS)
    def wrapped_test_func(
        config_name: str,
        grouping_input: GroupingInput,
        insta_snapshot: InstaSnapshotter,
    ) -> None:
        should_use_full_pipeline = config_name in FULL_PIPELINE_CONFIGS
        project = (
            Factories.create_project(Factories.create_organization())
            if should_use_full_pipeline
            else None
        )
        event = grouping_input.create_event(
            config_name,
            use_full_ingest_pipeline=should_use_full_pipeline,
            project=project,
        )

        # Create a snapshot function with the output path baked in
        create_snapshot = get_grouping_input_snapshotter(
            insta_snapshot,
            folder_name=test_func.__module__.split(".")[-1].replace("test_", ""),
            test_name=test_func.__name__,
            config_name=config_name,
            grouping_input_file=grouping_input.filename,
        )

        # Run the actual test
        test_func(
            event=event,
            variants=event.get_grouping_variants(),
            config_name=config_name,
            create_snapshot=create_snapshot,
        )

    return wrapped_test_func


class FingerprintInput:
    def __init__(self, filename: str) -> None:
        self.filename = filename

    @cached_property
    def data(self) -> MutableMapping[str, Any]:
        with open(path.join(FINGERPRINT_INPUTS_DIR, self.filename)) as f:
            return json.load(f)

    def create_event(self) -> tuple[FingerprintingConfig, Event]:
        config = FingerprintingConfig.from_json(
            {"rules": self.data.get("_fingerprinting_rules", [])},
            bases=GROUPING_CONFIG_CLASSES[DEFAULT_GROUPING_CONFIG].fingerprinting_bases,
        )
        mgr = EventManager(data=self.data)
        mgr.normalize()
        data = mgr.get_data()

        # Before creating the event, manually run the parts of `EventManager.save` which are
        # necessary for fingerprinting.

        data.setdefault("fingerprint", ["{{ default }}"])
        apply_server_side_fingerprinting(data, config)
        fingerprint_info = data.get("_fingerprint_info", {})
        custom_title_template = get_path(fingerprint_info, "matched_rule", "attributes", "title")

        if custom_title_template:
            resolved_title = expand_title_template(custom_title_template, data)
            data["title"] = resolved_title

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
        lines.append("{}hint: {}".format("  " * indent, variant.hint))

    # Note that this prints `__dict__`, not `as_dict()`, so if something seems missing, that's
    # probably why
    for key, value in sorted(variant.__dict__.items()):
        if key in [
            "config",
            "is_built_in",
            "hash",
            "contributing_component",
            "variant_name",
            "hint",
        ]:
            # We do not want to dump the config, the built-in-ness is included elsewhere, and we've
            # already dumped the others
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
        SNAPSHOTS_DIR,
        path.basename(test_file).replace("test_", "").replace(".py", ""),
        test_name,
        grouping_config_name.replace("-", "_").replace(":", "@"),
        input_file.replace("-", "_").replace(".json", ".pysnap"),
    )
