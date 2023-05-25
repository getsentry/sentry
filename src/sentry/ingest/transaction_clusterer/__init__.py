""" Strategies for clustering high-cardinality transaction names """


from enum import Enum
from typing import Dict


class ClustererNamespace(Enum):
    TRANSACTIONS = "transactions"


class NamespaceOption(Enum):

    DATA = "data"
    """Prefix to store input data to the clusterer."""
    RULES = "rules"
    """Prefix to store produced rules in the clusterer, in non-persistent storage."""
    PERSISTENT_STORAGE = "storage"
    """Option name to store produced rules in the clusterer, in persistent storage."""
    TRACKER = "tracker"
    """Option name to store tracking data of this namespace."""


CLUSTERER_NAMESPACE_OPTIONS: Dict[ClustererNamespace, Dict[NamespaceOption, str]] = {
    ClustererNamespace.TRANSACTIONS: {
        NamespaceOption.DATA: "txnames",
        NamespaceOption.RULES: "txrules",
        NamespaceOption.PERSISTENT_STORAGE: "sentry:transaction_name_cluster_rules",
        NamespaceOption.TRACKER: "txcluster.rules_per_project",
    }
}
