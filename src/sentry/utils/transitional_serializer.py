from json.decoder import JSONDecodeError
from typing import Any, Dict

from django.contrib.sessions.serializers import PickleSerializer
from django.core.signing import JSONSerializer


class TransitionalSerializer:
    def __init__(self) -> None:
        self.pickle_serializer = PickleSerializer()
        self.json_serializer = JSONSerializer()

    def dumps(self, obj: Dict[str, Any]) -> bytes:
        # will have the write as pickle obj for now, will change to json in seperate deploy
        # return self.json_serializer.dumps(obj)
        return self.pickle_serializer.dumps(obj)

    def loads(self, data: bytes) -> Dict[str, Any]:
        try:
            return self.json_serializer.loads(data)
        except JSONDecodeError:
            return self.pickle_serializer.loads(data)
