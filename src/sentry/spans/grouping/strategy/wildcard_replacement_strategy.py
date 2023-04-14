from typing import Optional, Sequence
from urllib.parse import urlparse

from .base import BaseSpanStrategy, Span
from .glob_replace import glob_replace

RULES = ["**/organizations/*/**"]


class WildcardReplacementStrategy(BaseSpanStrategy):
    def __call__(self, span: Span) -> Optional[Sequence[str]]:
        # TODO: Adapt the `span_op` decorator to work on callable methods
        # instead of manually comparing against `"http.client"` here
        if span.get("op") != "http.client":
            return None

        rules = RULES
        if len(rules) == 0:
            return None

        # TODO: Check span['data'] first, it'll have up-to-date parsed
        # information
        description = span.get("description") or ""

        # Check the description is of the form `<HTTP METHOD> <URL>`
        description = span.get("description") or ""
        parts = description.split(" ", 1)
        if len(parts) != 2:
            return None

        method, url = parts
        parsed_url = urlparse(url)

        for rule in rules:
            parameterized_path = glob_replace(parsed_url.path, rule)
            if parameterized_path != parsed_url.path:
                return [method, parsed_url.scheme, parsed_url.netloc, parameterized_path]

        return None
