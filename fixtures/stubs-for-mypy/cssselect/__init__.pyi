from .parser import SelectorNode


class SelectorSyntaxError(Exception): ...


class Selector:
    pseudo_element: object | None
    parsed_tree: SelectorNode


def parse(css: str) -> list[Selector]: ...
