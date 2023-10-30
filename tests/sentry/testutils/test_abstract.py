from sentry.testutils.abstract import Abstract


def test_abstract():
    class C:
        __test__ = Abstract(__module__, __qualname__)  # type: ignore[name-defined]  # python/mypy#10570

    class D(C):
        pass

    class E(D):
        pass

    assert C.__test__ is False
    assert D.__test__ is True
    assert E.__test__ is True
