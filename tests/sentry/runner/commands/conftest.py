import pytest


def pytest_generate_tests(metafunc: pytest.Metafunc):
    print(metafunc)
    breakpoint()
