from collections.abc import Callable
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class ApiDescription:
    """
    Describes a TypedDict response field in the public API schema.

    Wrap the field type in ``Annotated``; type checkers see only the inner type:

        class ProjectResponse(TypedDict):
            isMember: Annotated[bool, ApiDescription("Whether the requesting user is a member")]

    The text becomes the property's ``description`` in the generated OpenAPI schema.
    """

    text: str


@dataclass(frozen=True)
class ApiSchema:
    """
    Replaces the generated schema of a TypedDict response field with `build()`.

    Use it when another schema already pins the field down, such as a JSON Schema the
    code validates the data against, so the API schema can't drift from it. Wrap the
    field type in ``Annotated``; type checkers see only the inner type. `build` runs
    when the API schema is generated, so it can read registries. See
    `sentry.apidocs.json_schemas` to convert a JSON Schema.
    """

    build: Callable[[], dict[str, Any]]
