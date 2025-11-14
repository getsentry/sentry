from typing import int
"""Support for messaging integrations.

The current messaging integrations are Discord, MSTeams, and Slack.

TODO: Move the packages for individual integrations to be subpackages of this one
      (possibly in coordination with grouping other integrations by purpose)
"""

from .message_builder import *  # noqa: F401,F403
