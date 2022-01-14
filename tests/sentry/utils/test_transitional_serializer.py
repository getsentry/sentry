from django.contrib.sessions.serializers import PickleSerializer
from django.core.signing import JSONSerializer
from django.test.testcases import TestCase

from sentry.utils.transitional_serializer import TransitionalSerializer


class TransitionalSerializerTest(TestCase):
    obj = {"id": 1, "user": "user", "email": "email"}
    p_serializer = PickleSerializer()
    t_serializer = JSONSerializer()
    pickle_obj = p_serializer.dumps(obj)
    json_obj = t_serializer.dumps(obj)

    transitional_serializer = TransitionalSerializer()

    def test_read_json(self):
        assert self.transitional_serializer.loads(self.json_obj) == self.obj

    def test_read_pickle(self):
        assert self.transitional_serializer.loads(self.pickle_obj) == self.obj

    def test_write(self):
        assert self.transitional_serializer.dumps(self.obj) == self.pickle_obj
