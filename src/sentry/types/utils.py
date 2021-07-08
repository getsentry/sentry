from typing import TYPE_CHECKING

# TODO(3.8): This is a hack so we can get TypedDicts before 3.8
if TYPE_CHECKING:
    from mypy_extensions import TypedDict
else:

    def TypedDict(*args, **kwargs):
        pass
