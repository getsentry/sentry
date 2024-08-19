def _import_all():
    """Imports all strategy modules in a specific order due to cross dependencies.

    This function dynamically imports a list of strategy modules, ensuring that the
    import order is maintained to avoid issues arising from cross dependencies.

    Args:
        None

    Returns:
        None
    """
    # The import order here is important due to cross dependencies
    strategy_modules = [
        "message",
        "security",
        "template",
        "legacy",
        "newstyle",
        "configurations",
    ]
    for module in strategy_modules:
        __import__(f"{__name__}.{module}")


_import_all()
del _import_all
