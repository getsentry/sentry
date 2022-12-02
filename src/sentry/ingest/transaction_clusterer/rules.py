from datetime import datetime, timedelta
from typing import List, Mapping

from sentry.models import Project

from .base import ReplacementRule

RULE_RETENTION = timedelta(days=90)
OPTION_NAME = "sentry:transaction_clustering_rules"


def save_rules(project: Project, new_rules: List[ReplacementRule]):
    now = datetime.now()

    # Load existing rules and remove expired ones:
    now_timestamp = int(now.timestamp())
    new_expiry = int((now + RULE_RETENTION).timestamp())
    rules: dict = project.get_option(OPTION_NAME).get("rules", {})

    # TODO: Skip projects that never had any URL transactions.

    # Update existing rules with new rules, bumping expiry dates by
    # overwriting existing entries:
    # FIXME: This won't work, we have to bump the expiry date when we see
    # a sanitized transaction because that means the rule is still in place.
    rules_by_glob.update(
        **{
            rule: {
                "source": TRANSACTION_SOURCE,
                "type": "glob",
                "value": rule,
                "expires": new_expiry,
            }
            for rule in new_rules
        }
    )

    rules: List[RuleSpec] = list(rules_by_glob.values())

    # We're mixing old and new rules, so sort again
    rules.sort(key=lambda rule: rule["value"].count("/"), reverse=True)

    # TODO: Integration test
    project.update_option(OPTION_NAME, {"rules": rules})
