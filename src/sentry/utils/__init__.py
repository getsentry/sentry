"""
This is the Utilities Module. It is the home to small, self-contained classes and functions that do
useful things. This description is intentionally general because there are basically no limits to
what functionality can be considered a util.

WARNING:

Within this directory, avoid importing Sentry models and modules with side effects, as we want any
code importing a util to be able to run without having to pull in Django or other souces that might
not exist.

If you need to import a model purely for typing purposes, you can do the following:

    from __future__ import annotations

    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from sentry.models.organization import Organization

    def do_org_stuff(orgs: list[Organization]) -> None:
        # do some stuff with org objects

Otherwise, consider putting your code in another location. If you *must* import a model for use in a
utility function, and can't move the code, you can try moving the import inside the body of the
function.
"""
