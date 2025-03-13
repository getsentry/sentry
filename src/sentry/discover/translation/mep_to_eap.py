from typing import TypedDict

from parsimonious import NodeVisitor

from sentry.api.event_search import event_search_grammar


def apply_is_segment_condition(query: str) -> str:
    if query:
        return f"({query}) AND is_transaction:1"
    return "is_transaction:1"


def switcheroo(term):
    if term == "transaction.duration":
        return "span.duration"

    return term


class TranslationVisitor(NodeVisitor):
    def __init__(self):
        super().__init__()

    def visit_raw_aggregate_param(self, node, children):
        return switcheroo(node.text)

    def visit_key(self, node, children):
        return switcheroo(node.text)

    def visit_value(self, node, children):
        return switcheroo(node.text)

    def generic_visit(self, node, children):
        return children or node.text


class QueryParts(TypedDict):
    selected_columns: list[str]
    query: str
    equations: list[str] | None
    orderby: list[str] | None


def translate_mep_to_eap(query_parts: QueryParts):
    """
    This is a utility used to translate transactions/metrics/mep
    queries to eap queries. It takes in event query syntax (EQS)
    as input and outputs EQS as well. This will allow us to
    translate transaction queries from the frontend on the fly
    and also allow us to migrate all our Discover/Dashboard/Alert
    datamodels to store EAP compatible EQS queries.
    """
    flattened_query = []

    def _flatten(seq):
        for item in seq:
            if isinstance(item, list):
                _flatten(item)
            else:
                flattened_query.append(item)

    tree = event_search_grammar.parse(query_parts["query"])
    parsed = TranslationVisitor().visit(tree)
    _flatten(parsed)

    new_query = apply_is_segment_condition("".join(flattened_query))

    eap_query = QueryParts(
        query=new_query,
        selected_columns=query_parts["selected_columns"],
        equations=query_parts["equations"],
        orderby=query_parts["orderby"],
    )

    return eap_query
