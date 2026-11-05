from dataclasses import dataclass


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
