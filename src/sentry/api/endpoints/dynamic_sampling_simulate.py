import jsonschema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.base import Endpoint, region_silo_endpoint
from sentry.api.permissions import SuperuserPermission
from sentry.utils import json


@region_silo_endpoint
class DynamicSamplingSimulateEndpoint(Endpoint):
    permission_classes = (SuperuserPermission,)

    def post(self, request: Request) -> Response:
        """
        Simulates dynamic sampling on an event and returns the sample rate.
        """

        schema = {
            "type": "object",
            "properties": {
                "root_project_id": {"type": "string"},
                "project_id": {"type": "string"},
                "trace_headers": {
                    "type": "object",
                    "properties": {
                        "transaction": {"type": "string"},
                        "release": {"type": "string"},
                        "environment": {"type": "string"},
                        "replay_id": {"type": "string"},
                    },
                    "required": ["transaction", "release", "environment"],
                    "additionalProperties": False,
                },
                # This is only required in case root_project_id == project_id.
                "event_data": {
                    "type": "object",
                    "properties": {"transaction": {"type": "string"}},
                    "required": ["transaction"],
                    "additionalProperties": False,
                },
            },
            "required": ["trace_headers", "root_project_id", "project_id"],
            "additionalProperties": False,
        }

        try:
            data = json.loads(request.body)
            jsonschema.validate(data, schema)
        except jsonschema.ValidationError as e:
            return Response({"error": str(e).splitlines()[0]}, status=400)
        except Exception:
            return Response({"error": "Invalid json body"}, status=400)

        return Response({"nothing": 1}, status=200)
