""" Strategies for clustering high-cardinality transaction names """


from enum import Enum
from typing import Dict


class ClustererDataNamespace(Enum):
    TRANSACTIONS = "txnames"


class ClustererRuleNamespace(Enum):
    TRANSACTIONS = "txrules"


class PROJECT_OPTION_KEYS(Enum):
    STORAGE = "storage_option"
    TRACKER = "tracker_option"


PROJECT_OPTION_NAMES: Dict[ClustererRuleNamespace, Dict[PROJECT_OPTION_KEYS, str]] = {
    ClustererRuleNamespace.TRANSACTIONS: {
        PROJECT_OPTION_KEYS.STORAGE: "sentry:transaction_name_cluster_rules",
        PROJECT_OPTION_KEYS.TRACKER: "txcluster.rules_per_project",
    }
}
