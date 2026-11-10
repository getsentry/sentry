from __future__ import annotations

from typing import Any, TypedDict


class InvestigationParameterSerializerResponse(TypedDict):
    """
    Parameter definition and saved override. type and constraints govern accepted values;
    defaultValue and savedValue may be null. Use key in the parameter-values update request.
    """

    id: str
    key: str
    label: str
    description: str
    type: str
    required: bool
    constraints: dict[str, Any]
    defaultValue: Any
    savedValue: Any
    source: str
    position: int
    version: int
