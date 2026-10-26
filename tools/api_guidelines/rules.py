from enum import StrEnum


class ApiRule(StrEnum):
    """
    Rule codes tracked by the API guidelines tooling

    Note: S021-S023 are listed for reference: they're always enforced and have no
    baseline. Only S025-S028 are baselined. Later stages add their codes here
    """

    # Every type declared with inline_sentry_response_serializer(...) in @extend_schema must
    # also appear in the method's Response[T] return annotation
    S021 = "S021"
    # Published endpoint methods must declare their response type: no missing return
    # annotation, and no bare Response
    S022 = "S022"
    # A field omitted from the public schema must have a recorded reason, and must name a
    # field that exists
    S023 = "S023"
    # A serializer validates the query string or request body, but isn't declared in
    # @extend_schema(parameters=...) or (request=...), so the docs don't show that input
    S025 = "S025"
    # A query or body value is read straight off the request instead of through a serializer
    # declared in @extend_schema, so it's undocumented and unvalidated
    S026 = "S026"
    # A query or body value is read with a computed key (a variable, not a literal string),
    # so no schema can say which keys the endpoint accepts
    S027 = "S027"
    # The whole query dict or request body is handed to something that isn't a serializer,
    # so what the endpoint accepts can't be determined from the code
    S028 = "S028"
