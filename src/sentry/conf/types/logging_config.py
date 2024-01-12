from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from logging.config import _DictConfigArgs
else:
    _DictConfigArgs = dict


class LoggingConfig(_DictConfigArgs):
    default_level: str
    overridable: list[str]
