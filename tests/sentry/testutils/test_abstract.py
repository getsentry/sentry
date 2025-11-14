from typing import int
from sentry.testutils.abstract import Abstract


def test_abstract() -> None:
    class C:
        __test__ = Abstract(__module__, __qualname__)

    class D(C):
        pass

    class E(D):
        pass

    assert C.__test__ is False
    assert D.__test__ is True
    assert E.__test__ is True
