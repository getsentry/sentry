from sentry.api.serializers import Serializer, serialize
from sentry.testutils import TestCase
from sentry.testutils.silo import control_silo_test


class Foo:
    pass


class FooSerializer(Serializer):
    def serialize(self, *args, **kwargs):
        return "lol"


class VariadicSerializer(Serializer):
    def serialize(self, obj, attrs, user, kw):
        return {"kw": kw}


class FailingChildSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs):
        raise Exception


class ParentSerializer(Serializer):
    def get_attrs(self, item_list, user, **kwargs):
        return {item: {"child_data": Foo()} for item in item_list}

    def serialize(self, obj, attrs, user, **kwargs):
        return {
            "parent": "something",
            "child": serialize(attrs["child_data"], serializer=FailingChildSerializer()),
        }


@control_silo_test(stable=True)
class BaseSerializerTest(TestCase):
    def test_serialize(self):
        assert serialize([]) == []
        assert serialize(None) is None

        user = self.create_user()
        # We don't want to assert on the value, just that it serialized
        assert isinstance(serialize(user), dict)

        # explicitly passed serializer
        foo_serializer = FooSerializer()
        assert serialize(user, serializer=foo_serializer) == "lol"

        foo = Foo()
        assert serialize(foo) is foo, "should return the object when unknown"
        assert serialize(foo, serializer=foo_serializer) == "lol"

        rv = serialize([user])
        assert isinstance(rv, list)
        assert len(rv) == 1

        rv = serialize([user, None])
        assert isinstance(rv, list)
        assert len(rv) == 2
        assert rv[1] is None

        rv = serialize([None, user])
        assert isinstance(rv, list)
        assert len(rv) == 2
        assert rv[0] is None
        assert isinstance(rv[1], dict)

    def test_serialize_additional_kwargs(self):
        foo = Foo()
        user = self.create_user()
        result = serialize(foo, user, VariadicSerializer(), kw="keyword")
        assert result["kw"] == "keyword"

    def test_child_serializer_failure(self):
        foo = Foo()

        result = serialize(foo, serializer=ParentSerializer())
        assert result["parent"] == "something"
        assert result["child"] is None
