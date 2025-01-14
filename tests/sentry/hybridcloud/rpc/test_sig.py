import pydantic

from sentry.hybridcloud.rpc.sig import SerializableFunctionSignature
from sentry.testutils.cases import TestCase


class SerializableFunctionSignatureTest(TestCase):
    def test_signature(self) -> None:
        class AnObject(pydantic.BaseModel):
            a: int
            b: str

        def a_function(arg1: AnObject, arg2: AnObject) -> AnObject:
            raise NotImplementedError

        sig = SerializableFunctionSignature(a_function)
        arg_values = dict(arg1=AnObject(a=1, b="foo"), arg2=AnObject(a=2, b="bar"))
        serialized_arguments = sig.serialize_arguments(arg_values)
        assert serialized_arguments == {"arg1": {"a": 1, "b": "foo"}, "arg2": {"a": 2, "b": "bar"}}

        deserialized_arguments = sig.deserialize_arguments(serialized_arguments)
        assert isinstance(deserialized_arguments, pydantic.BaseModel)
        assert set(deserialized_arguments.__dict__.keys()) == {"arg1", "arg2"}
        assert hasattr(deserialized_arguments, "arg1")
        assert deserialized_arguments.arg1 == AnObject(a=1, b="foo")
        assert hasattr(deserialized_arguments, "arg2")
        assert deserialized_arguments.arg2 == AnObject(a=2, b="bar")

        deserialized_return_value = sig.deserialize_return_value(dict(a=3, b="qux"))
        assert deserialized_return_value == AnObject(a=3, b="qux")
