""" Strategies for clustering high-cardinality transaction names """


from dataclasses import dataclass
from enum import Enum


@dataclass(frozen=True)
class NamespaceOption:
    name: str
    """Human-friendly name of the namespace. For example, logging purposes."""
    data: str
    """Prefix to store input data to the clusterer."""
    rules: str
    """Prefix to store produced rules in the clusterer, in non-persistent storage."""
    persistent_storage: str
    """Option name to store produced rules in the clusterer, in persistent storage."""
    tracker: str
    """Option name to emit tracking data of this namespace, such as metrics."""
    meta_store: str
    """Option name to emit store metadata belonging to this namespace."""


class ClustererNamespace(Enum):
    TRANSACTIONS = NamespaceOption(
        name="transactions",
        data="txnames2",
        rules="txrules",
        persistent_storage="sentry:transaction_name_cluster_rules",
        tracker="txcluster.rules_per_project",
        meta_store="sentry:transaction_name_cluster_meta",
    )
    SPANS = NamespaceOption(
        name="spans",
        data="span.descs.data2",
        rules="span.descs.rules",
        persistent_storage="sentry:span_description_cluster_rules",
        tracker="span.descs.rules_per_project",
        meta_store="sentry:span_descriptions_cluster_meta",
    )
