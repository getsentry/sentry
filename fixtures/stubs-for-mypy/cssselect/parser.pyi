from __future__ import annotations

class SelectorError(Exception): ...
class SelectorSyntaxError(SelectorError): ...

type SelectorNode = Attrib | Class | CombinedSelector | Element | Hash

class Selector:
    parsed_tree: SelectorNode
    pseudo_element: str | None

    def __init__(self, tree: SelectorNode, pseudo_element: str | None = None) -> None: ...

class Attrib:
    selector: SelectorNode
    namespace: str | None
    attrib: str
    operator: str
    value: str | None

    def __init__(
        self,
        selector: SelectorNode,
        namespace: str | None,
        attrib: str,
        operator: str,
        value: str | None,
    ) -> None: ...

class Class:
    selector: SelectorNode
    class_name: str

    def __init__(self, selector: SelectorNode, class_name: str) -> None: ...

class CombinedSelector:
    selector: SelectorNode
    combinator: str
    subselector: SelectorNode

    def __init__(
        self, selector: SelectorNode, combinator: str, subselector: SelectorNode
    ) -> None: ...

class Element:
    namespace: str | None
    element: str | None

    def __init__(self, namespace: str | None = None, element: str | None = None) -> None: ...

class Hash:
    selector: SelectorNode
    id: str

    def __init__(self, selector: SelectorNode, id: str) -> None: ...

def parse(css: str) -> list[Selector]: ...
