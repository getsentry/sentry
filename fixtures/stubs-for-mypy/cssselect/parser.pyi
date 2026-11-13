from __future__ import annotations

from typing import TypeAlias

SelectorNode: TypeAlias = Attrib | Class | Element | Hash

class Selector:
    pseudo_element: str | None
    parsed_tree: SelectorNode | CombinedSelector

class Attrib:
    operator: str | None
    attrib: str
    value: str
    selector: SelectorNode

class Class:
    class_name: str
    selector: SelectorNode

class Element:
    element: str

class Hash:
    id: str
    selector: SelectorNode

class CombinedSelector:
    pass
