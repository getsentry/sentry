#!/usr/bin/env sentry exec

from __future__ import annotations

from sentry.utils.silo.add_silo_decorators import add_silo_decorators
from sentry.utils.silo.common import Keywords

"""
Instructions for use:

1. Commit or stash any Git changes in progress.
2. Add keywords to identify model and api classes in each silo.
3. From the Sentry project root, do
     ./scripts/decorators/silo/audit_silo_decorators.py | ./scripts/decorators/silo/add_silo_decorators.py
4. Do `git status` or `git diff` to observe the results. Commit if you're happy.
"""

SILO_KEYWORDS = {
    "control": Keywords(
        include_words=["User", "Auth", "Identity"],
    ),
    "region": Keywords(
        include_words=["Organization", "Project", "Team", "Group", "Event", "Issue"],
        exclude_words=["JiraIssue"],
    ),
}

if __name__ == "__main__":
    add_silo_decorators(silo_keywords=SILO_KEYWORDS)
