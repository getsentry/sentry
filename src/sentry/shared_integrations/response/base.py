from __future__ import annotations

from collections import OrderedDict
from typing import Any, Mapping

import requests
from django.utils.functional import cached_property
from requests import Response

from sentry.shared_integrations.exceptions import UnsupportedResponseType
from sentry.utils import json


class BaseApiResponse:
    text = ""

    def __init__(
        self,
        headers: Mapping[str, str] | None = None,
        status_code: int | None = None,
    ) -> None:
        self.headers = headers
        self.status_code = status_code

    def __repr__(self) -> str:
        name = type(self).__name__
        code = self.status_code
        content_type = (self.headers or {}).get("Content-Type", "")
        return f"<{name}: code={code}, content_type={content_type}>"

    @property
    def json(self) -> Any:
        raise NotImplementedError

    @cached_property  # type: ignore
    def rel(self) -> Mapping[str, str]:
        link_header = (self.headers or {}).get("Link", "")
        parsed_links = requests.utils.parse_header_links(link_header)  # type: ignore
        return {item["rel"]: item["url"] for item in parsed_links}

    @classmethod
    def from_response(
        cls,
        response: Response,
        allow_text: bool = False,
        ignore_webhook_errors: bool = False,
    ) -> BaseApiResponse:
        from sentry.shared_integrations.response import (
            MappingApiResponse,
            SequenceApiResponse,
            TextApiResponse,
            XmlApiResponse,
        )

        if response.request.method == "HEAD":
            return BaseApiResponse(response.headers, response.status_code)
        # XXX(dcramer): this doesnt handle leading spaces, but they're not common
        # paths so its ok
        if response.text.startswith("<?xml"):
            return XmlApiResponse(response.text, response.headers, response.status_code)
        elif response.text.startswith("<"):
            if not allow_text:
                raise ValueError(f"Not a valid response type: {response.text[:128]}")
            elif ignore_webhook_errors and response.status_code >= 300:
                return BaseApiResponse()
            elif response.status_code < 200 or response.status_code >= 300:
                raise ValueError(
                    f"Received unexpected plaintext response for code {response.status_code}"
                )
            return TextApiResponse(response.text, response.headers, response.status_code)

        # Some APIs will return JSON with an invalid content-type, so we try
        # to decode it anyways
        if "application/json" not in response.headers.get("Content-Type", ""):
            try:
                data = json.loads(response.text, object_pairs_hook=OrderedDict)
            except (TypeError, ValueError):
                if allow_text:
                    return TextApiResponse(response.text, response.headers, response.status_code)
                raise UnsupportedResponseType(
                    response.headers.get("Content-Type", ""), response.status_code
                )
        elif response.text == "":
            return TextApiResponse(response.text, response.headers, response.status_code)
        else:
            data = json.loads(response.text, object_pairs_hook=OrderedDict)

        if isinstance(data, dict):
            return MappingApiResponse(data, response.headers, response.status_code)
        elif isinstance(data, (list, tuple)):
            return SequenceApiResponse(data, response.headers, response.status_code)
        elif ignore_webhook_errors:
            return BaseApiResponse(response.headers, response.status_code)
        else:
            raise NotImplementedError
