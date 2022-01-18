from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Sequence

from . import Attribute
from .utils import get_data


class Map(Attribute):
    def __init__(
        self, name: str, attributes: Sequence[Attribute] | None = None, required: bool = True
    ) -> None:
        super().__init__(name, str, required)
        self.attributes = attributes or ()

    def extract(self, value: dict[str, Any] | Any | None) -> Mapping[str, Any] | None:
        """
        If passed a non dictionary we assume we can pull attributes from it.

        This will hard error in some situations if you're passing a bad type
        (like an int).
        """
        if value is None:
            return value

        if isinstance(value, dict):
            # Ensure we don't mutate the original. We do not need to deepcopy;
            # if it recurses into another Map it will once again copy itself.
            # TODO(mgaeta): If the dictionary has a list or some other complex
            #  object in it, that object will not be copied.
            items = value.copy()
        else:
            new_value = {}
            for attr in self.attributes:
                new_value[attr.name] = attr.extract(getattr(value, attr.name, None))
            items = new_value

        return get_data(self.attributes, items)
