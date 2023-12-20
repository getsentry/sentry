from __future__ import annotations

from typing import Any


class Abstract:
    """usage: `__test__ = Abstract(__module__, __qualname__)`

    ideally tests would be well-factored functions and not a (often confusing) inheritance and
    mixin hierarchy.

    that reality is unfortunately not well realized in sentry so this is a small helper to allow
    "mixin"-like base classes that aren't considered tests until inherited.

    ```python
    class MyTestBase(TestCase):
        __test__ = Abstract(__module__, __qualname__)  # `False` in base class and `True` otherwise

        def test_whatever(self):
            foo(self.organization)

    class MyConcreteTest(MyTestBase): ...
    class MyOtherConcreteTestTest(MyTestBase): ...
    ```
    """

    def __init__(self, module: str, qualname: str) -> None:
        self.module = module
        self.qualname = qualname

    def __repr__(self) -> str:
        return f"{type(self).__name__}({self.qualname!r})"

    def __get__(self, inst: object, owner: type[Any]) -> bool:
        return (owner.__module__, owner.__qualname__) != (self.module, self.qualname)
