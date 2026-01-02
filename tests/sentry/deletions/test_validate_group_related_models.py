"""
Tests to ensure all models with group foreign keys are properly registered
in group deletion configuration.
"""

from __future__ import annotations

from collections.abc import Mapping

import django.apps
from django.db import models as django_models

from sentry.db.models import FlexibleForeignKey
from sentry.deletions.defaults.group import (
    ADDITIONAL_GROUP_RELATED_MODELS,
    DIRECT_GROUP_RELATED_MODELS,
)
from sentry.testutils.cases import TestCase


class GroupRelatedModelsCompletenessTest(TestCase):
    """
    Validates that all models with group foreign keys are accounted for in the
    deletion configuration to prevent orphaned records or cascade delete timeouts.
    """

    # Models that don't need to be in either list (with justification).
    # Note: Having a custom deletion task does NOT automatically handle group deletion.
    # Models with group_id foreign keys must be explicitly added to one of the lists.
    EXEMPTED_MODELS: Mapping[str, str] = {
        # Add models here if they shouldn't be in either list, with a comment explaining why
        # Example: "sentry.SomeModel": "Uses custom deletion logic in XYZ",
        "sentry.Activity": "To be added soon",
        "sentry.PlatformExternalIssue": "TBD",
        "workflow_engine.DetectorGroup": "TBD",
        "workflow_engine.WorkflowActionGroupStatus": "TBD",
        "workflow_engine.WorkflowFireHistory": "TBD",
    }

    def get_models_with_group_foreign_key(self) -> set[type[django_models.Model]]:
        """
        Discover all models that have a foreign key to Group.
        """
        from sentry.models.group import Group

        models_with_group_fk = set()

        for model_class in django.apps.apps.get_models():
            # Skip the Group model itself
            if model_class.__name__ == "Group":
                continue

            # Check all fields for foreign keys to Group
            for field in model_class._meta.get_fields():
                if isinstance(field, (django_models.ForeignKey, FlexibleForeignKey)):
                    # Check if it points to Group
                    if hasattr(field, "related_model") and field.related_model == Group:
                        models_with_group_fk.add(model_class)
                        break

        return models_with_group_fk

    def test_all_group_related_models_are_registered(self) -> None:
        """
        Ensure all models with group foreign keys are in one of:
        - DIRECT_GROUP_RELATED_MODELS
        - ADDITIONAL_GROUP_RELATED_MODELS
        - EXEMPTED_MODELS (with justification)
        """
        models_with_group_fk = self.get_models_with_group_foreign_key()

        # Get all registered models
        registered_models = set(DIRECT_GROUP_RELATED_MODELS) | set(ADDITIONAL_GROUP_RELATED_MODELS)

        # Find unregistered models
        unregistered = set()
        for model in models_with_group_fk:
            model_label = f"{model._meta.app_label}.{model.__name__}"

            # Skip if model is registered or exempted
            if model in registered_models or model_label in self.EXEMPTED_MODELS:
                continue

            unregistered.add(model_label)

        if unregistered:
            error_msg = [
                "\n\nModels with group_id foreign keys are not registered in group deletion configuration!",
                "\nThis can cause orphaned records or cascade delete timeouts.",
                "\n\nUnregistered models:",
            ]
            for model_label in sorted(unregistered):
                error_msg.append(f"  - {model_label}")

            error_msg.extend(
                [
                    "\n\nTo fix this, add the model to one of these in src/sentry/deletions/defaults/group.py:",
                    "  1. DIRECT_GROUP_RELATED_MODELS - if it should be transferred during reprocessing",
                    "  2. ADDITIONAL_GROUP_RELATED_MODELS - if it has event_id or shouldn't transfer",
                    "  3. EXEMPTED_MODELS in this test - if it has special handling (with justification)",
                    "\nSee comments in group.py for decision criteria.",
                ]
            )

            raise AssertionError("".join(error_msg))

    def test_exempted_models_have_justification(self) -> None:
        """
        Ensure all exempted models have a comment explaining why.
        """
        for model_label, reason in self.EXEMPTED_MODELS.items():
            assert reason and reason.strip(), (
                f"Model {model_label} is exempted but has no justification. "
                f"Add a comment explaining why it doesn't need registration."
            )

    def test_no_duplicate_models_in_lists(self) -> None:
        """
        Ensure no model appears in both DIRECT_GROUP_RELATED_MODELS and
        ADDITIONAL_GROUP_RELATED_MODELS.
        """
        direct_set = set(DIRECT_GROUP_RELATED_MODELS)
        additional_set = set(ADDITIONAL_GROUP_RELATED_MODELS)

        duplicates = direct_set & additional_set

        if duplicates:
            duplicate_names = [f"{m._meta.app_label}.{m.__name__}" for m in duplicates]
            raise AssertionError(
                f"Models appear in both DIRECT_GROUP_RELATED_MODELS and "
                f"ADDITIONAL_GROUP_RELATED_MODELS: {', '.join(duplicate_names)}"
            )
