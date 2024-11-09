from django.db import models

from sentry.backup.scopes import RelocationScope
from sentry.db.models import DefaultFieldsModel, region_silo_model, sane_repr
from sentry.workflow_engine.types import DataConditionResult


@region_silo_model
class DataConditionGroup(DefaultFieldsModel):
    """
    A data group is a way to specify a group of conditions that must be met for a workflow action to execute
    """

    __relocation_scope__ = RelocationScope.Organization
    __repr__ = sane_repr("logic_type")

    class Type(models.TextChoices):
        ANY = "any"
        ALL = "all"
        NONE = "none"

    logic_type = models.CharField(max_length=200, choices=Type.choices, default=Type.ANY)
    organization = models.ForeignKey("sentry.Organization", on_delete=models.CASCADE)

    def evaluate_conditions(self, value=None) -> tuple[bool, list[DataConditionResult]]:
        """
        Evaluate each condition with the given value
        """
        results: list[tuple[bool, DataConditionResult]] = []

        for condition in self.conditions.all():
            evaluation_result = condition.evaluate_value(value)
            is_condition_triggered = evaluation_result is not None

            # ANY conditions always return 1 condition, the first one matched
            if is_condition_triggered and self.logic_type == self.Type.ANY:
                # TODO - Should this fast return? do we want to evaluate all the conditions
                # and return all that match here?
                return is_condition_triggered, [evaluation_result]
            else:
                results.append((is_condition_triggered, evaluation_result))

        # ALL conditions must not have any "None" results
        # and returns all the condition results that were evaluated
        if self.logic_type == self.Type.ALL:
            is_all_conditions_met = all([result[0] for result in results])

            if is_all_conditions_met:
                condition_results = [result[1] for result in results if result[0]]
                return is_all_conditions_met, condition_results

        return False, []
