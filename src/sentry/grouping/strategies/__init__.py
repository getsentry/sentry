from __future__ import absolute_import


def _import_all():
    # The import order here is important due to cross dependencies
    strategy_modules = [
        "message",
        "security",
        "template",
        "legacy",
        "newstyle",
        "combined",
        "configurations",
    ]
    for module in strategy_modules:
        __import__("%s.%s" % (__name__, module))


_import_all()
del _import_all
