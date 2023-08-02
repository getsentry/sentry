from __future__ import annotations

# Discord likes colors as decimal integers
LEVEL_TO_COLOR = {
    "_actioned_issue": int("0xEDEEEF", 16),
    "_incident_resolved": int("0x4DC771", 16),
    "debug": int("0xFBE14F", 16),
    "error": int("0xE03E2F", 16),
    "fatal": int("0xFA4747", 16),
    "info": int("0x2788CE", 16),
    "warning": int("0xFFC227", 16),
}

INCIDENT_COLOR_MAPPING = {
    "Resolved": "_incident_resolved",
    "Warning": "warning",
    "Critical": "fatal",
}

DISCORD_URL_FORMAT = "[{text}]({url})"
