from typing import TypedDict


class SetupAcknowledgementResponse(TypedDict):
    orgHasAcknowledged: bool
    userHasAcknowledged: bool
