from typing import Any

from emmett55.extensions import Extension


class Sentry(Extension):
    namespace: str | None
    default_config: dict[str, Any]
