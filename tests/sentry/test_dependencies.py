import pydantic


def test_pydantic_1x_compiled() -> None:
    if not pydantic.VERSION.startswith("1."):
        raise AssertionError("delete this test, it only applies to pydantic 1.x")
    # pydantic is horribly slow when not cythonized
    assert pydantic.__file__.endswith(".so")
