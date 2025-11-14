from typing import int
def _import_all() -> None:
    # The import order here is important due to cross dependencies
    strategy_modules = [
        "message",
        "security",
        "template",
        "newstyle",
        "configurations",
    ]
    for module in strategy_modules:
        __import__(f"{__name__}.{module}")


_import_all()
del _import_all
