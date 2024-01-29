import pytest
from sentry.utils.types import IntType

def test_int_type_call_with_none():
    int_type = IntType()
    result = int_type(None)
    assert result == 0  # Expecting the default value for IntType
