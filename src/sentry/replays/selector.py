from typing import List, Optional, Union

from cssselect import Attrib, Class, Element, Hash, Selector

SelectorType = Union[Attrib, Class, Element, Hash]


class QueryType:
    def __init__(self):
        self.alt: Optional[str] = None
        self.aria_label: Optional[str] = None
        self.classes: List[str] = []
        self.id: Optional[str] = None
        self.role: Optional[str] = None
        self.tag: Optional[str] = None
        self.testid: Optional[str] = None
        self.title: Optional[str] = None


def parse_selector(css_selector: str) -> List[QueryType]:
    # TODO: This can fail.
    selectors: List[Selector] = css_selector.parse(css_selector)

    queries: List[QueryType] = []
    for selector in selectors:
        query = QueryType()
        visit_selector_tree(query, selector.parsed_tree)
        queries.append(query)
    return queries


def visit_selector_tree(query: QueryType, selector: SelectorType) -> None:
    """Visit selector tree ignoring unhandled items.

    We intentionally ignore specificity and psuedo-elements.

    Cssselect refers to a selector as a "parsed_tree". While this is true its best thought of as
    a linked-list. The first element encountered in the list is the last condition defined in the
    selector text. The "Element" class is always the tail and has no children.
    """
    if isinstance(selector, Attrib):
        visit_attribute(query, selector)
        visit_selector_tree(query, selector.selector)
    elif isinstance(selector, Class):
        visit_class(query, selector)
        visit_selector_tree(query, selector.selector)
    elif isinstance(selector, Element):
        visit_element(query, selector)
        return None
    elif isinstance(selector, Hash):
        visit_hash(query, selector)
        visit_selector_tree(query, selector.selector)
    else:
        # We ignore unhandled selector types rather than erroring.
        visit_selector_tree(query, selector.selector)


def visit_attribute(query: QueryType, attribute: Attrib) -> None:
    """Visit attribute selector types."""
    attrib = attribute.attrib
    if attrib == "alt":
        query.alt = attribute.value
    elif attrib == "aria-label":
        query.aria_label = attribute.value
    elif attrib == "role":
        query.role = attribute.value
    elif attrib == "data-testid":
        query.testid = attribute.value
    elif attrib == "title":
        query.title = attribute.value


def visit_class(query: QueryType, class_: Class) -> None:
    """Visit class selector types."""
    query.classes.append(class_.class_name)


def visit_element(query: QueryType, element: Element) -> None:
    """Visit element selector types."""
    query.tag = element.element


def visit_hash(query: QueryType, hash_: Hash) -> None:
    """Visit hash selector types."""
    query.id = hash_.id
