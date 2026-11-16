from __future__ import annotations

from dataclasses import replace

import pytest

from sentry.notebooks.services.producer_sources import (
    PRODUCER_SOURCE_TYPES,
    ResolvedProducerSource,
    get_producer_source_type,
    register_producer_source_type,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.notebook_producer_sources import (
    EXAMPLE_SOURCE_TYPE,
    register_example_source_type,
)


class ProducerSourceTypeRegistryTest(TestCase):
    def test_registered_type_is_found(self) -> None:
        assert get_producer_source_type(EXAMPLE_SOURCE_TYPE.name) is None
        register_example_source_type(self)
        assert get_producer_source_type(EXAMPLE_SOURCE_TYPE.name) is EXAMPLE_SOURCE_TYPE

    def test_engine_and_manual_types_cannot_be_registered(self) -> None:
        for name in ("manual", "metric_open_period"):
            with pytest.raises(ValueError):
                register_producer_source_type(replace(EXAMPLE_SOURCE_TYPE, name=name))
            assert name not in PRODUCER_SOURCE_TYPES

    def test_type_must_fit_the_source_type_column(self) -> None:
        with pytest.raises(ValueError):
            register_producer_source_type(replace(EXAMPLE_SOURCE_TYPE, name="x" * 33))
        assert "x" * 33 not in PRODUCER_SOURCE_TYPES

    def test_type_cannot_contain_a_colon(self) -> None:
        with pytest.raises(ValueError):
            register_producer_source_type(replace(EXAMPLE_SOURCE_TYPE, name="example:issue"))
        assert "example:issue" not in PRODUCER_SOURCE_TYPES

    def test_producer_is_checked_like_the_type(self) -> None:
        for producer in ("example:writer", "x" * 33):
            with pytest.raises(ValueError):
                register_producer_source_type(replace(EXAMPLE_SOURCE_TYPE, producer=producer))
        assert EXAMPLE_SOURCE_TYPE.name not in PRODUCER_SOURCE_TYPES

    def test_a_different_type_cannot_take_a_registered_name(self) -> None:
        register_example_source_type(self)
        register_producer_source_type(EXAMPLE_SOURCE_TYPE)

        with pytest.raises(ValueError):
            register_producer_source_type(replace(EXAMPLE_SOURCE_TYPE, producer="other"))
        assert PRODUCER_SOURCE_TYPES[EXAMPLE_SOURCE_TYPE.name] is EXAMPLE_SOURCE_TYPE

    def test_one_producer_can_own_several_types(self) -> None:
        register_example_source_type(self)
        other = replace(EXAMPLE_SOURCE_TYPE, name="example_trace")
        register_producer_source_type(other)
        self.addCleanup(PRODUCER_SOURCE_TYPES.pop, other.name)

        assert get_producer_source_type(other.name) is other

    def test_key_and_source_carry_the_type(self) -> None:
        resolved = ResolvedProducerSource(
            key="42", source={"type": "other", "ref": {"issueId": 42}}, project_ids=[]
        )
        assert EXAMPLE_SOURCE_TYPE.source_key(resolved) == "example_issue:42"
        assert EXAMPLE_SOURCE_TYPE.notebook_source(resolved) == {
            "type": "example_issue",
            "ref": {"issueId": 42},
        }
