from typing import Any

import orjson
from rest_framework.response import Response
from urllib3.exceptions import HTTPError

from sentry.seer.signed_seer_api import (
    make_signed_seer_api_request,
    seer_autofix_default_connection_pool,
)


def forward_workflow_request(
    method: str, path: str, *, operation: str, data: Any = None
) -> Response:
    try:
        upstream = make_signed_seer_api_request(
            seer_autofix_default_connection_pool,
            "/v1/automation/investigation-workflows" + path,
            method=method,
            body=b"" if data is None else orjson.dumps(data),
            metrics_endpoint="/v1/automation/investigation-workflows/" + operation,
            retries=False,
        )
    except HTTPError:
        return Response({"detail": "Could not reach Seer."}, status=502)
    if upstream.status >= 500:
        return Response({"detail": "Seer could not complete the workflow request."}, status=502)
    try:
        body = orjson.loads(upstream.data)
    except orjson.JSONDecodeError:
        return Response({"detail": "Invalid workflow response from Seer."}, status=502)
    if upstream.status == 422 and isinstance(body, dict) and isinstance(body.get("detail"), list):
        messages = [
            f"{'.'.join(map(str, issue.get('loc', [])))} — {issue['msg']}"
            for issue in body["detail"]
            if isinstance(issue, dict) and "msg" in issue
        ]
        return Response({"detail": "\n".join(messages)}, status=422)
    return Response(body, status=upstream.status)
