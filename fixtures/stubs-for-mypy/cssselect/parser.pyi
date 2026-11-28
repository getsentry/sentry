from typing import TypeAlias


class Element:
    element: str


class CombinedSelector: ...


class Attrib:
    operator: str
    attrib: str
    value: str
    selector: SelectorNode


class Class:
    class_name: str
    selector: SelectorNode


class Hash:
    id: str
    selector: SelectorNode


SelectorNode: TypeAlias = Attrib | Class | Element | Hash | CombinedSelector
