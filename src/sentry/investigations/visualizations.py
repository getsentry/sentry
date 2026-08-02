from __future__ import annotations

import re
from typing import Any


def suggest_visualization_change(
    *,
    result: dict[str, Any],
    visualization: dict[str, Any],
    requested_change: str,
    current_intent: str,
) -> dict[str, Any]:
    """Translate a bounded natural-language display edit without touching data."""
    prompt = requested_change.strip()
    normalized = prompt.lower()
    revised = dict(visualization)

    for chart_type in ("line", "area", "bar", "heatmap", "wheel"):
        if re.search(rf"\b{chart_type}(?:\s+chart)?\b", normalized):
            revised["type"] = chart_type
            break
    if "stacked" in normalized:
        revised["stacked"] = True
    if "unstacked" in normalized or "grouped bars" in normalized:
        revised["stacked"] = False
    if "hide legend" in normalized or "without a legend" in normalized:
        revised["showLegend"] = False
    elif "show legend" in normalized or "with a legend" in normalized:
        revised["showLegend"] = True

    title_match = re.search(
        r"(?:title (?:it|this)|call (?:it|this))\s+['\"]?(.+?)['\"]?$", prompt, re.I
    )
    if title_match:
        revised["title"] = title_match.group(1).strip()

    top_match = re.search(r"\btop\s+(\d{1,2})\b", normalized)
    if top_match:
        revised["topN"] = min(max(int(top_match.group(1)), 1), 20)
    if "ascending" in normalized:
        revised["sort"] = "ascending"
    elif "descending" in normalized or "largest first" in normalized:
        revised["sort"] = "descending"

    available = {
        str(column["key"]).lower(): str(column["key"]) for column in result["table"]["columns"]
    }
    for series in (result.get("chart") or {}).get("series", []):
        available[str(series["name"]).lower()] = str(series["name"])

    grouping_match = re.search(
        r"\b(?:group(?:ed)?(?:\s+this)?|break(?:en)? down|split|color(?:ed)?)\s+by\s+([\w.:-]+)",
        normalized,
    )
    missing_field: str | None = None
    if grouping_match:
        requested_field = grouping_match.group(1)
        resolved_field = available.get(requested_field)
        if resolved_field:
            revised["seriesField"] = resolved_field
        else:
            missing_field = requested_field

    sufficient = missing_field is None
    response: dict[str, Any] = {
        "visualization": revised,
        "existingResultSufficient": sufficient,
    }
    if not sufficient:
        response["revisedQueryIntent"] = f"{current_intent.rstrip('.')} grouped by {missing_field}."
    return response
