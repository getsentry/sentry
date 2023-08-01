"""
Contains the definition of MQL, the Metrics Query Language.
"""

# TODO: grammar
# TODO: parser
# TODO: visitor

from .types import Expression


def parse_expression(dsl: str) -> Expression:
    """
    Parse a metrics expression from a string.
    """

    raise NotImplementedError("Cannot parse DSL yet")
