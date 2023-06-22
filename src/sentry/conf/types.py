from typing import Any, Mapping, Sequence, TypedDict

import click
from typing_extensions import Required

# Do not import _anything_ by sentry from here, or mypy/django-stubs will break
# typing for django settings globally.


class TopicDefinition(TypedDict):
    cluster: str


class ConsumerDefinition(TypedDict, total=False):
    # Which logical topic from settings to use.
    topic: Required[str]

    strategy_factory: Required[str]

    # Additional CLI options the consumer should accept. These arguments are
    # passed as kwargs to the strategy_factory.
    click_options: Sequence[click.Option]

    # Hardcoded additional kwargs for strategy_factory
    static_args: Mapping[str, Any]

    require_synchronization: bool
    synchronize_commit_group_default: str
    synchronize_commit_log_topic_default: str
