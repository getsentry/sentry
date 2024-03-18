import pydantic

from sentry.services.hybrid_cloud.sig import SerializableFunctionSignature
from sentry.testutils.cases import TestCase
from sentry.utils import json


class SerializableFunctionSignatureTest(TestCase):
    def test_signature(self):
        class AnObject(pydantic.BaseModel):
            a: int
            b: str

        def a_function(arg1: AnObject, arg2: AnObject) -> AnObject:
            return AnObject(a=arg1.a + arg2.a, b=".".join((arg1.b, arg2.b)))

        sig = SerializableFunctionSignature(a_function)
        arg_values = dict(arg1=AnObject(a=1, b="foo"), arg2=AnObject(a=2, b="bar"))
        serialized_arguments = sig.serialize_arguments(arg_values)
        assert serialized_arguments == {"arg1": {"a": 1, "b": "foo"}, "arg2": {"a": 2, "b": "bar"}}

        deserialized_arguments = sig.deserialize_arguments(serialized_arguments)
        assert isinstance(deserialized_arguments, pydantic.BaseModel)
        assert set(deserialized_arguments.__dict__.keys()) == {"arg1", "arg2"}
        assert deserialized_arguments.arg1 == AnObject(a=1, b="foo")
        assert deserialized_arguments.arg2 == AnObject(a=2, b="bar")

        deserialized_return_value = sig.deserialize_return_value(dict(a=3, b="qux"))
        assert deserialized_return_value == AnObject(a=3, b="qux")

    def test_schemas(self):
        class AnObject(pydantic.BaseModel):
            a: int
            b: str

        def a_function(arg1: AnObject, arg2: AnObject) -> AnObject:
            return AnObject(a=arg1.a + arg2.a, b=".".join((arg1.b, arg2.b)))

        sig = SerializableFunctionSignature(a_function)

        parameter_schema, return_schema = sig.dump_schemas()
        parameter_model = json.loads(parameter_schema)
        return_model = json.loads(return_schema)
        assert AnObject.__name__ in parameter_model["definitions"].keys()
        assert set(parameter_model["properties"]) == {"arg1", "arg2"}
        assert AnObject.__name__ in return_model["definitions"].keys()
        assert set(return_model["properties"]) == {"value"}
