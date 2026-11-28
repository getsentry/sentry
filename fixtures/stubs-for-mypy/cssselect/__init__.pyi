from cssselect.parser import (
    Attrib as Attrib,
    Class as Class,
    CombinedSelector as CombinedSelector,
    Element as Element,
    Hash as Hash,
    Selector as Selector,
)

class SelectorSyntaxError(Exception): ...

def parse(css: str) -> list[Selector]: ...
