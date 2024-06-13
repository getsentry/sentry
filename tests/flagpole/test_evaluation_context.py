from dataclasses import dataclass
from typing import Any

import pytest

from flagpole.evaluation_context import ContextBuilder, EvaluationContext, EvaluationContextDict


class TestEvaluationContext:
    # Identity fields tests are mainly upholding that our hashing strategy does
    # not change in the future, and that we calculate the id using the correct
    # context values and keys in order.
    def test_adds_identity_fields(self):
        eval_context = EvaluationContext({}, set())
        assert eval_context.id == 1245845410931227995499360226027473197403882391305

        eval_context = EvaluationContext({"foo": "bar", "baz": "barfoo"}, {"foo"})
        expected_id = 484477975355580460928302712356218993825269143262
        assert eval_context.id == expected_id

        # Assert that we skip the missing field but still generate the same
        # context ID.
        eval_context = EvaluationContext({"foo": "bar", "baz": "barfoo"}, {"foo", "whoops"})
        assert eval_context.id == expected_id

        eval_context = EvaluationContext({"foo": "bar", "baz": "barfoo"}, {"foo", "baz"})
        expected_id = 1249805218608667754842212156585681631068251083301
        assert eval_context.id == expected_id

        # Assert that we use all properties to generate the context when all
        # identity fields are missing.
        eval_context = EvaluationContext({"foo": "bar", "baz": "barfoo"}, {"whoops", "test"})
        assert eval_context.id == expected_id

    def test_no_identity_fields_included(self):
        eval_context = EvaluationContext({})
        assert eval_context.id == 1245845410931227995499360226027473197403882391305

        eval_context = EvaluationContext({"foo": "bar", "baz": "barfoo"})
        expected_id = 1249805218608667754842212156585681631068251083301
        assert eval_context.id == expected_id

        eval_context = EvaluationContext({"foo": "bar", "baz": "barfoo", "test": "property"})
        expected_id = 1395427532315258482176540981434194664973697472186
        assert eval_context.id == expected_id

    def test_get_has_data(self):
        eval_context = EvaluationContext({"foo": "bar", "baz": "barfoo"}, {"foo"})

        assert eval_context.has("foo") is True
        assert eval_context.get("foo") == "bar"
        assert eval_context.has("baz") is True
        assert eval_context.get("baz") == "barfoo"
        assert eval_context.has("bar") is False
        assert eval_context.get("bar") is None


@dataclass
class ContextData:
    foo: str | None = None
    baz: int | None = None
    buzz: dict | set | None = None


class TestContextBuilder:
    def test_empty_context_builder(self):
        context_builder = ContextBuilder[ContextData]()
        context = context_builder.build()

        assert context.size() == 0

    def test_static_transformer(self):
        def static_transformer(_data: ContextData) -> dict[str, Any]:
            return dict(foo="bar", baz=1)

        eval_context = (
            ContextBuilder[ContextData]()
            .add_context_transformer(static_transformer)
            .build(ContextData())
        )

        assert eval_context.size() == 2
        assert eval_context.get("foo") == "bar"
        assert eval_context.get("baz") == 1

    def test_transformer_with_data(self):
        def transformer_with_data(data: ContextData) -> dict[str, Any]:
            return dict(foo="bar", baz=getattr(data, "baz", None))

        eval_context = (
            ContextBuilder[ContextData]()
            .add_context_transformer(transformer_with_data)
            .build(ContextData(baz=2))
        )

        assert eval_context.size() == 2
        assert eval_context.get("foo") == "bar"
        assert eval_context.get("baz") == 2

    def test_multiple_context_transformers(self):
        def transformer_one(data: ContextData) -> dict[str, Any]:
            return dict(foo="overwrite_me", baz=2, buzz=getattr(data, "buzz"))

        def transformer_two(_data: ContextData) -> dict[str, Any]:
            return dict(foo="bar")

        eval_context = (
            ContextBuilder[ContextData]()
            .add_context_transformer(transformer_one)
            .add_context_transformer(transformer_two)
            .build(ContextData(foo="bar", buzz={1, 2, 3}))
        )

        assert eval_context.size() == 3
        assert eval_context.get("foo") == "bar"
        assert eval_context.get("baz") == 2
        assert eval_context.get("buzz") == {1, 2, 3}

    def test_with_exception_handler(self):
        exc_message = "oh noooooo"

        def broken_transformer(_data: ContextData) -> EvaluationContextDict:
            raise Exception(exc_message)

        context_builder = ContextBuilder[ContextData]().add_context_transformer(broken_transformer)

        with pytest.raises(Exception) as exc:
            context_builder.build(ContextData())

        assert exc.match(exc_message)

        # Ensure builder doesn't raise an exception
        context_builder.add_exception_handler(lambda _exc: None)
        context_builder.build(ContextData())

        with pytest.raises(Exception):
            context_builder.add_exception_handler(lambda _exc: None)

    # This is nearly identical to the evaluation context around identity fields,
    # just to ensure we compile and pass the correct list
    def test_identity_fields_passing(self):
        def transformer_with_data(_data: ContextData) -> dict[str, Any]:
            return dict(foo="bar", baz="barfoo")

        eval_context = ContextBuilder[ContextData]().build(ContextData(baz=2))

        # This should be empty dictionary, empty identity fields list
        assert eval_context.id == 1245845410931227995499360226027473197403882391305

        eval_context = (
            ContextBuilder[ContextData]()
            .add_context_transformer(transformer_with_data, ["foo"])
            .build(ContextData(baz=2))
        )

        expected_context_id = 484477975355580460928302712356218993825269143262
        assert eval_context.id == expected_context_id

        # The full identity_fields list passed into the context should be
        # ["foo", "baz", "whoops"], but "whoops" will be filtered out by the
        # context since the field does not exist in the context dict.
        eval_context = (
            ContextBuilder[ContextData]()
            .add_context_transformer(transformer_with_data, ["foo"])
            .add_context_transformer(transformer_with_data, ["baz", "whoops"])
            .build(ContextData(baz=2))
        )

        expected_context_id = 1249805218608667754842212156585681631068251083301
        assert eval_context.id == expected_context_id
