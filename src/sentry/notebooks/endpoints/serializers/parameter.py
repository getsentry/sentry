from __future__ import annotations

from typing import Annotated, TypedDict

from sentry.apidocs.descriptions import ApiDescription
from sentry.apidocs.formats import JsonValue


class NotebookParameterSerializerResponse(TypedDict):
    """
    Parameter definition and saved override. type and constraints govern accepted values;
    defaultValue and savedValue may be null. Use key in the parameter-values update request.
    """

    id: Annotated[str, ApiDescription("The parameter ID")]
    key: Annotated[str, ApiDescription("The key blocks use to refer to the parameter")]
    label: Annotated[str, ApiDescription("The parameter's display name")]
    description: Annotated[str, ApiDescription("What the parameter is for")]
    type: Annotated[str, ApiDescription("The type of value the parameter takes")]
    required: Annotated[bool, ApiDescription("Whether the parameter needs a value")]
    constraints: Annotated[
        dict[str, JsonValue], ApiDescription("Limits on the parameter's value, by type")
    ]
    defaultValue: Annotated[JsonValue, ApiDescription("The value used when none is saved")]
    savedValue: Annotated[JsonValue, ApiDescription("The saved value, or null")]
    source: Annotated[str, ApiDescription("Who defined the parameter")]
    position: Annotated[int, ApiDescription("The parameter's position in the notebook")]
    version: Annotated[int, ApiDescription("The parameter's concurrency token")]
