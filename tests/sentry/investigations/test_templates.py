from __future__ import annotations

import pytest

from sentry.investigations.models import InvestigationBlockKind, InvestigationSourceType
from sentry.investigations.templates import (
    InvestigationTemplateSpec,
    get_investigation_template,
)
from sentry.investigations.templates.breached_metric import BREACHED_METRIC_TEMPLATE
from sentry.investigations.templates.registry import _TEMPLATES

ALL_TEMPLATES = tuple(_TEMPLATES.values())


def test_registry_resolves_a_registered_template() -> None:
    template = get_investigation_template("breached_metric", 1)

    assert template is BREACHED_METRIC_TEMPLATE


def test_registry_returns_none_for_an_unknown_key() -> None:
    assert get_investigation_template("does_not_exist", 1) is None


def test_registry_returns_none_for_an_unknown_version() -> None:
    assert get_investigation_template("breached_metric", 2) is None


def test_registry_is_keyed_by_key_and_version() -> None:
    for (key, version), template in _TEMPLATES.items():
        assert template.key == key
        assert template.version == version


def test_registry_is_immutable() -> None:
    with pytest.raises(TypeError):
        _TEMPLATES["breached_metric", 1] = BREACHED_METRIC_TEMPLATE  # type: ignore[index]


@pytest.mark.parametrize("template", ALL_TEMPLATES, ids=lambda t: f"{t.key}-v{t.version}")
def test_block_keys_are_unique(template: InvestigationTemplateSpec) -> None:
    keys = [block.key for block in template.blocks]

    assert len(keys) == len(set(keys))


@pytest.mark.parametrize("template", ALL_TEMPLATES, ids=lambda t: f"{t.key}-v{t.version}")
def test_dependencies_name_blocks_in_the_same_template(
    template: InvestigationTemplateSpec,
) -> None:
    """A typo'd dependency key would otherwise only surface at instantiation."""
    block_keys = {block.key for block in template.blocks}

    for block in template.blocks:
        unknown = set(block.dependencies) - block_keys
        assert not unknown, f"{block.key} depends on unknown block(s): {sorted(unknown)}"


@pytest.mark.parametrize("template", ALL_TEMPLATES, ids=lambda t: f"{t.key}-v{t.version}")
def test_no_block_depends_on_itself(template: InvestigationTemplateSpec) -> None:
    for block in template.blocks:
        assert block.key not in block.dependencies


@pytest.mark.parametrize("template", ALL_TEMPLATES, ids=lambda t: f"{t.key}-v{t.version}")
def test_block_parameters_are_declared_by_the_template(
    template: InvestigationTemplateSpec,
) -> None:
    parameter_keys = {parameter.key for parameter in template.parameters}

    for block in template.blocks:
        unknown = set(block.parameters) - parameter_keys
        assert not unknown, f"{block.key} uses undeclared parameter(s): {sorted(unknown)}"


@pytest.mark.parametrize("template", ALL_TEMPLATES, ids=lambda t: f"{t.key}-v{t.version}")
def test_parameter_keys_are_unique(template: InvestigationTemplateSpec) -> None:
    keys = [parameter.key for parameter in template.parameters]

    assert len(keys) == len(set(keys))


@pytest.mark.parametrize("template", ALL_TEMPLATES, ids=lambda t: f"{t.key}-v{t.version}")
def test_block_kinds_are_valid(template: InvestigationTemplateSpec) -> None:
    valid = set(InvestigationBlockKind.values)

    assert all(block.kind in valid for block in template.blocks)


@pytest.mark.parametrize("template", ALL_TEMPLATES, ids=lambda t: f"{t.key}-v{t.version}")
def test_source_type_is_valid_and_not_manual(template: InvestigationTemplateSpec) -> None:
    assert template.source_type in set(InvestigationSourceType.values)
    # A template-backed investigation records source lineage, which the model's
    # check constraint forbids for the manual source type.
    assert template.source_type != InvestigationSourceType.MANUAL


@pytest.mark.parametrize("template", ALL_TEMPLATES, ids=lambda t: f"{t.key}-v{t.version}")
def test_specs_are_frozen(template: InvestigationTemplateSpec) -> None:
    with pytest.raises(AttributeError):
        template.key = "mutated"  # type: ignore[misc]

    for block in template.blocks:
        with pytest.raises(AttributeError):
            block.key = "mutated"  # type: ignore[misc]


class TestBreachedMetricTemplate:
    def test_declares_the_expected_blocks(self) -> None:
        assert [block.key for block in BREACHED_METRIC_TEMPLATE.blocks] == [
            "metric_chart",
            "overview",
            "synthesis",
            "contributors",
        ]

    def test_is_a_breached_metric_source(self) -> None:
        assert BREACHED_METRIC_TEMPLATE.source_type == InvestigationSourceType.BREACHED_METRIC

    def test_synthesis_depends_on_both_query_blocks(self) -> None:
        synthesis = next(
            block for block in BREACHED_METRIC_TEMPLATE.blocks if block.key == "synthesis"
        )

        assert set(synthesis.dependencies) == {"metric_chart", "contributors"}

    def test_every_block_auto_runs(self) -> None:
        assert all(block.config.get("autoRun") is True for block in BREACHED_METRIC_TEMPLATE.blocks)

    def test_query_blocks_default_to_the_chart_view(self) -> None:
        query_blocks = [
            block
            for block in BREACHED_METRIC_TEMPLATE.blocks
            if block.kind == InvestigationBlockKind.QUERY
        ]

        assert query_blocks
        assert all(block.display["defaultView"] == "chart" for block in query_blocks)

    def test_text_blocks_use_the_markdown_display(self) -> None:
        text_blocks = [
            block
            for block in BREACHED_METRIC_TEMPLATE.blocks
            if block.kind == InvestigationBlockKind.TEXT
        ]

        assert text_blocks
        assert all(block.display == {"type": "markdown"} for block in text_blocks)

    def test_every_block_carries_a_generation_prompt(self) -> None:
        assert all(block.generation_prompt.strip() for block in BREACHED_METRIC_TEMPLATE.blocks)

    def test_takes_no_parameters(self) -> None:
        assert BREACHED_METRIC_TEMPLATE.parameters == ()
