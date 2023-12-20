from typing import List, Optional, Union

from cssselect import Selector, SelectorSyntaxError
from cssselect import parse as cssselect_parse
from cssselect.parser import Attrib, Class, CombinedSelector, Element, Hash
from rest_framework.exceptions import ParseError

SelectorType = Union[Attrib, Class, Element, Hash]


class QueryType:
    def __init__(self):
        self.alt: Optional[str] = None
        self.aria_label: Optional[str] = None
        self.classes: List[str] = []
        self.id: Optional[str] = None
        self.component_name: Optional[str] = None
        self.role: Optional[str] = None
        self.tag: Optional[str] = None
        self.testid: Optional[str] = None
        self.title: Optional[str] = None


def parse_selector(css_selector: str) -> List[QueryType]:
    try:
        selectors: List[Selector] = cssselect_parse(css_selector)
    except SelectorSyntaxError:
        # Invalid selector syntax. No query data can be extracted.
        return []

    queries: List[QueryType] = []
    for selector in selectors:
        if selector.pseudo_element is not None:
            raise ParseError("Pseudo-elements are not supported.")

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

    For example:

        Attrib -> Class -> Hash -> Class -> Attrib -> Element
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
    elif isinstance(selector, CombinedSelector):
        raise ParseError("Nested selectors are not supported.")
    else:
        raise ParseError("Only attribute, class, id, and tag name selectors are supported.")


def visit_attribute(query: QueryType, attribute: Attrib) -> None:
    """Visit attribute selector types."""
    if attribute.operator != "=":
        raise ParseError("Only the '=' operator is supported.")

    attrib = attribute.attrib
    if attrib == "alt":
        query.alt = attribute.value
    elif attrib == "aria-label":
        query.aria_label = attribute.value
    elif attrib == "data-sentry-component":
        query.component_name = attribute.value
    elif attrib == "role":
        query.role = attribute.value
    elif attrib == "data-testid":
        query.testid = attribute.value
    elif attrib == "data-test-id":
        query.testid = attribute.value
    elif attrib == "title":
        query.title = attribute.value
    else:
        raise ParseError(
            "Invalid attribute specified. Only alt, aria-label, role, data-testid, data-test-id, "
            "data-sentry-component, and title are supported."
        )


def visit_class(query: QueryType, class_: Class) -> None:
    """Visit class selector types."""
    query.classes.append(class_.class_name)


def visit_element(query: QueryType, element: Element) -> None:
    """Visit element selector types."""
    query.tag = element.element


def visit_hash(query: QueryType, hash_: Hash) -> None:
    """Visit hash selector types."""
    query.id = hash_.id
