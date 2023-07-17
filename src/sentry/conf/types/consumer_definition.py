from __future__ import annotations

from typing import Any, Callable, Mapping, Sequence, TypedDict

import click
from typing_extensions import Required


class ConsumerDefinition(TypedDict, total=False):
    # Which logical topic from settings to use.
    topic: Required[str | Callable[[], str]]
    default_topic: str

    strategy_factory: Required[str]

    # Additional CLI options the consumer should accept. These arguments are
    # passed as kwargs to the strategy_factory.
    click_options: Sequence[click.Option]

    # Hardcoded additional kwargs for strategy_factory
    static_args: Mapping[str, Any]

    require_synchronization: bool
    synchronize_commit_group_default: str
    synchronize_commit_log_topic_default: str
