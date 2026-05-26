from typing import Any

from emmett55 import response
from emmett55.serializers import Serializers
from emmett_core.http.response import HTTPBytesResponse

json = Serializers.get_for("json")


def abort_with_json(status: int, json_data: Any) -> None:
    response.status = status
    response.content_type = "application/json"
    raise HTTPBytesResponse(status, body=json(json_data), headers=response.headers)
