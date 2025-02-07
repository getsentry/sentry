import pydantic
import pytest


def test_pydantic_1x_compiled() -> None:
    if not pydantic.VERSION.startswith("1."):
        raise AssertionError("delete this test, it only applies to pydantic 1.x")
    # pydantic is horribly slow when not cythonized
    assert pydantic.__file__.endswith(".so")


def test_pytz_is_not_installed() -> None:
    with pytest.raises(ImportError):
        __import__("pytz")  # do not allow this to creep in.  use zoneinfo
