from datetime import datetime, timezone
from json.decoder import JSONDecodeError
from typing import Any, Dict

from django.contrib.sessions.serializers import PickleSerializer
from django.core.signing import JSONSerializer


class TransitionalSerializer:
    def __init__(self) -> None:
        self.pickle_serializer = PickleSerializer()
        self.json_serializer = JSONSerializer()

    def _convert_datetime_to_timestamp(self, obj):
        for key in obj:
            if type(obj[key]) == datetime:
                formatted_time = obj[key].timestamp()
                obj[key] = f"timestamp:{formatted_time}"
            elif type(obj[key]) == dict:
                self._convert_datetime_to_timestamp(obj[key])
        return obj

    def _convert_timestamp_to_datetime(self, data):
        for key in data:
            if type(data[key]) is str and "timestamp:" in data[key]:
                timestamp = float(data[key].replace("timestamp:", ""))
                data[key] = datetime.fromtimestamp(timestamp, timezone.utc)
            elif type(data[key]) == dict:
                self._convert_timestamp_to_datetime(data[key])
        return data

    def dumps(self, obj: Dict[str, Any]) -> bytes:
        serializable_obj = self._convert_datetime_to_timestamp(obj)
        return self.json_serializer.dumps(serializable_obj)

    def loads(self, data: bytes) -> Dict[str, Any]:
        try:
            data_obj = self._convert_timestamp_to_datetime(self.json_serializer.loads(data))
            return data_obj
        except JSONDecodeError:
            return self.pickle_serializer.loads(data)
