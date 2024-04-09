from typing import Any

from flagpole.evaluation_context import ContextBuilder


class TestEvaluationContext:
    pass


class TestContextBuilder:
    def test_empty_context_builder(self):
        context_builder = ContextBuilder()
        context = context_builder.build()

        assert context.size() == 0

    def test_static_transformer(self):
        def static_transformer(_data: dict[str, Any]) -> dict[str, Any]:
            return dict(foo="bar", baz=1)

        eval_context = ContextBuilder().add_context_transformer(static_transformer).build()

        assert eval_context.size() == 2
        assert eval_context.get("foo") == "bar"
        assert eval_context.get("baz") == 1

    def test_transformer_with_data(self):
        def transformer_with_data(data: dict[str, Any]) -> dict[str, Any]:
            return dict(foo="bar", baz=data.get("baz"))

        eval_context = (
            ContextBuilder().add_context_transformer(transformer_with_data).build({"baz": 2})
        )

        assert eval_context.size() == 2
        assert eval_context.get("foo") == "bar"
        assert eval_context.get("baz") == 2

    def test_multiple_context_transformers(self):
        def transformer_one(data: dict[str, Any]) -> dict[str, Any]:
            return dict(foo="overwrite_me", baz=2, buzz=data.get("buzz"))

        def transformer_two(_data: dict[str, Any]) -> dict[str, Any]:
            return dict(foo="bar")

        eval_context = (
            ContextBuilder()
            .add_context_transformer(transformer_one)
            .add_context_transformer(transformer_two)
            .build({"foo": "bar", "buzz": {1, 2, 3}})
        )

        assert eval_context.size() == 3
        assert eval_context.get("foo") == "bar"
        assert eval_context.get("baz") == 2
        assert eval_context.get("buzz") == {1, 2, 3}
