import logging

import requests
from attr import dataclass

from sentry import options

logger = logging.getLogger(__name__)


def voice_available() -> bool:
    return bool(options.get("voice.11labs.token"))


@dataclass
class VoiceAgentParameters:
    issue_summary: str | None = None
    title: str | None = None


def send_voice_call(phone_number: str, params: VoiceAgentParameters) -> bool:
    dynamic_vars = {}
    if params.issue_summary:
        dynamic_vars["issue_summary"] = params.issue_summary
    if params.title:
        dynamic_vars["issue_title"] = params.title

    data = {
        "agent_id": options.get("voice.11labs.agent_id"),
        "agent_phone_number_id": options.get("voice.11labs.agent_phone_number_id"),
        "to_number": phone_number,
        "conversation_initiation_client_data": {"dynamic_variables": dynamic_vars},
    }
    logger.info("11labs POST data: %s", data)
    rv = requests.post(
        "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
        headers={
            "xi-api-key": options.get("voice.11labs.token"),
            "Content-Type": "application/json",
        },
        json=data,
    )
    if not rv.ok:
        logger.error(
            "Failed to send voice call to %s: (%s) %s", phone_number, rv.status_code, rv.content
        )
        return False
