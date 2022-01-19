from datetime import datetime
from json.decoder import JSONDecodeError
from typing import Any, Dict

from django.contrib.sessions.serializers import PickleSerializer
from django.core.signing import JSONSerializer


class TransitionalSerializer:
    def __init__(self) -> None:
        self.pickle_serializer = PickleSerializer()
        self.json_serializer = JSONSerializer()

    def dumps(self, obj: Dict[str, Any]) -> bytes:
        for key in obj:
            if type(obj[key]) == datetime:
                formatted_time = obj[key].timestamp()
                obj[key] = formatted_time
        return self.json_serializer.dumps(obj)

    def loads(self, data: bytes) -> Dict[str, Any]:
        try:
            return self.json_serializer.loads(data)
        except JSONDecodeError:
            return self.pickle_serializer.loads(data)
