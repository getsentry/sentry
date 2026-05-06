"""Example custom tools for SeerAgentClient demos."""

from __future__ import annotations

from pydantic import BaseModel, Field

from sentry.models.organization import Organization
from sentry.seer.agent.custom_tool_utils import AgentTool


class SpellWordParams(BaseModel):
    word: str = Field(description="The word to spell out letter by letter")


class SpellWordTool(AgentTool[SpellWordParams]):
    """Returns a word with its letters separated by hyphens."""

    params_model = SpellWordParams

    @classmethod
    def get_description(cls) -> str:
        return "Spell a word out letter-by-letter, separated by hyphens."

    @classmethod
    def execute(cls, organization: Organization, params: SpellWordParams) -> str:
        return "-".join(params.word)
