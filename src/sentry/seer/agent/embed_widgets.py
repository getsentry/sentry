from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class EmbedWidgetBody(BaseModel):
    """JSON Schema describing the attributes/data an embed widget accepts."""

    type: str = "object"
    properties: dict[str, dict[str, str]]
    required: list[str] = Field(default_factory=list)


class EmbedWidget(BaseModel):
    """Definition for a single embed widget sent to Seer.

    Seer uses these to generate markdown tags (e.g. ``{% timestamp %}{ "value": ... }{% /timestamp %}``)
    which the frontend ``Tag`` component renders.
    """

    name: str
    description: str
    body: EmbedWidgetBody
    level: list[Literal["inline", "block"]]


SEER_EMBED_WIDGETS: list[EmbedWidget] = []


def get_embed_widgets() -> list[dict[str, Any]]:
    """Serialize all registered embed widgets for the Seer API."""
    return [w.dict() for w in SEER_EMBED_WIDGETS]
