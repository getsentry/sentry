from dataclasses import dataclass
from typing import Any

import pytest

from flagpole.evaluation_context import ContextBuilder, EvaluationContextDict


class TestEvaluationContext:
    pass


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
