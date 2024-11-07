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

    def evaluate(
        self, value
    ) -> tuple[bool, DataConditionResult | list[DataConditionResult] | None]:
        """
        Evaluate each condition with the given value
        """
        results: list[DataConditionResult] = []

        for condition in self.datacondition_set.all():
            evaluation_result = condition.evaluate_value(value)

            # ANY conditions always return 1 condition, the first one matched
            if evaluation_result and self.logic_type == self.Type.ANY:
                return (evaluation_result is not None, evaluation_result)
            else:
                results.append(evaluation_result)

        # ALL conditions must not have any "None" results
        # and returns all the condition results that were evaluated
        if self.logic_type == self.Type.ALL:
            validated_results: list[DataConditionResult] = [
                item for item in results if item is not None
            ]
            return (len(validated_results) == len(results), validated_results)

        return (False, None)
