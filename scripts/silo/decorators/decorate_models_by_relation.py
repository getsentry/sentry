#!/usr/bin/env sentry exec

from __future__ import annotations

from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.utils.silo.decorate_models_by_relation import (
    TargetRelations,
    decorate_models_by_relation,
)

"""
This is an alternative to add_silo_decorators.py that uses an algorithmic definition of
the silos and aims for 100% coverage. It examines the fields of model classes and
uses a graph traversal algorithm to find all models that point to the `Organization`
model, either directly or through a number of steps. Those models are tagged for the
region silo, and all others for the control silo.

Instructions for use:

1. Commit or stash any Git changes in progress.
2. Update foreign key relationships to identify models in the region silo.
2. From the Sentry project root, do
     ./scripts/decorators/silo/decorate_models_by_relation.py
3. Do `git status` or `git diff` to observe the results. Commit if you're happy.
"""

REGION_TARGET_RELATIONS = TargetRelations(
    # Foreign key relationships
    models=[Organization],
    naming_conventions={
        # Covers BoundedBigIntegerFields used as soft foreign keys
        "organization_id": Organization,
        "project_id": Project,
        "group_id": Group,
        "release_id": Release,
    },
)

if __name__ == "__main__":
    decorate_models_by_relation(target_relations=REGION_TARGET_RELATIONS)
