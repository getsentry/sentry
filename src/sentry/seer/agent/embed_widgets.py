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


DOCS_LINK_WIDGET = EmbedWidget(
    name="docs-link",
    description=(
        "Render a rich inline link to a page in the Sentry documentation. Use this "
        "whenever you reference a Sentry feature, concept, or setup step that has "
        "official docs so the user can jump straight to it. The url must be an "
        "absolute https://docs.sentry.io/... URL; links to any other host are ignored."
    ),
    body=EmbedWidgetBody(
        properties={
            "url": {
                "type": "string",
                "description": ("Absolute docs URL, e.g. https://docs.sentry.io/product/issues/."),
            },
            "title": {
                "type": "string",
                "description": "Short human-readable label for the link.",
            },
        },
        required=["url", "title"],
    ),
    level=["inline", "block"],
)


SEER_EMBED_WIDGETS: list[EmbedWidget] = [DOCS_LINK_WIDGET]


def get_embed_widgets() -> list[dict[str, Any]]:
    """Serialize all registered embed widgets for the Seer API."""
    return [w.dict() for w in SEER_EMBED_WIDGETS]
