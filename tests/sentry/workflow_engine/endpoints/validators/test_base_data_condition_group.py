from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseDataConditionGroupValidator
from sentry.workflow_engine.models import Condition, DataConditionGroup


class TestBaseDataConditionGroupValidator(TestCase):
    def setUp(self):
        self.context = {"organization": self.organization, "request": self.make_request()}

        self.valid_data = {
            "logicType": DataConditionGroup.Type.ANY,
            "organizationId": self.organization.id,
            "conditions": [],
        }
        self.validator = BaseDataConditionGroupValidator(data=self.valid_data, context=self.context)

    def test_conditions__empty(self):
        assert self.validator.is_valid() is True

    def test_conditions__valid_conditions(self):
        condition_group = self.create_data_condition_group()
        self.valid_data["conditions"] = [
            {
                "type": Condition.EQUAL,
                "comparison": 1,
                "conditionResult": True,
                "conditionGroupId": condition_group.id,
            },
            {
                "type": Condition.GREATER,
                "comparison": 0,
                "conditionResult": True,
                "conditionGroupId": condition_group.id,
            },
        ]
        validator = BaseDataConditionGroupValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid() is True

    def test_conditions__invalid_condition(self):
        self.valid_data["conditions"] = [{"comparison": 0}]
        validator = BaseDataConditionGroupValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid() is False

    def test_conditions__custom_handler__invalid_to_schema(self):
        self.valid_data["conditions"] = [
            {
                "type": Condition.AGE_COMPARISON,
                "comparison": {
                    "comparison_type": "older",
                    "value": 1,
                    "time": "days",  # Invalid
                },
                "conditionResult": True,
                "conditionGroupId": 1,
            }
        ]

        validator = BaseDataConditionGroupValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid() is False

    def test_conditions__custom_handler__valid__missing_group_id(self):
        self.valid_data["conditions"] = [
            {
                "type": Condition.AGE_COMPARISON,
                "comparison": {
                    "comparison_type": "older",
                    "value": 1,
                    "time": "day",
                },
                "conditionResult": True,
                # conditionGroupId missing
            }
        ]

        validator = BaseDataConditionGroupValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid() is True

    def test_conditions__custom_handler(self):
        self.valid_data["conditions"] = [
            {
                "type": Condition.AGE_COMPARISON,
                "comparison": {
                    "comparison_type": "older",
                    "value": 1,
                    "time": "day",
                },
                "conditionResult": True,
                "conditionGroupId": 1,
            }
        ]

        validator = BaseDataConditionGroupValidator(data=self.valid_data, context=self.context)
        assert validator.is_valid() is True


class TestBaseDataConditionGroupValidatorCreate(TestBaseDataConditionGroupValidator):
    def test_create(self):
        # Validate the data and raise any exceptions if invalid to halt test
        self.validator.is_valid(raise_exception=True)
        result = self.validator.create(self.validator.validated_data)

        # Validate the condition group is created correctly
        assert result.logic_type == DataConditionGroup.Type.ANY
        assert result.organization_id == self.organization.id
        assert result.conditions.count() == 0

    def test_create__with_conditions(self):
        self.valid_data["conditions"] = [
            {
                "type": Condition.EQUAL,
                "comparison": 1,
                "conditionResult": True,
            }
        ]

        validator = BaseDataConditionGroupValidator(data=self.valid_data, context=self.context)
        validator.is_valid(raise_exception=True)
        result = validator.create(validator.validated_data)

        assert result.conditions.count() == 1

        condition = result.conditions.first()
        assert condition is not None

        assert condition.type == Condition.EQUAL
        assert condition.comparison == 1
        assert condition.condition_group == result


class TestBaseDataConditionGroupValidatorUpdate(TestBaseDataConditionGroupValidator):
    def test_update(self):
        self.valid_data["conditions"] = [
            {
                "type": Condition.EQUAL,
                "comparison": 1,
                "conditionResult": True,
            }
        ]
        validator = BaseDataConditionGroupValidator(data=self.valid_data, context=self.context)
        validator.is_valid(raise_exception=True)
        dcg = validator.create(validator.validated_data)
        assert dcg.conditions.count() == 1
        condition = dcg.conditions.first()
        assert condition

        # update condition
        self.valid_data["conditions"] = [
            {
                "id": condition.id,
                "type": Condition.EQUAL,
                "comparison": 2,  # update to 2 from 1
                "conditionResult": True,
            }
        ]
        validator = BaseDataConditionGroupValidator(data=self.valid_data, context=self.context)
        validator.is_valid(raise_exception=True)
        dcg = validator.update(dcg, validator.validated_data)

        assert dcg.conditions.count() == 1
        condition = dcg.conditions.first()
        assert condition is not None

        assert condition.type == Condition.EQUAL
        assert condition.comparison == 2
        assert condition.condition_group == dcg

        # add another condition
        self.valid_data["conditions"].append(
            {
                "conditionGroupId": dcg.id,
                "type": Condition.NOT_EQUAL,
                "comparison": 5,
                "conditionResult": True,
            }
        )
        validator = BaseDataConditionGroupValidator(data=self.valid_data, context=self.context)
        validator.is_valid(raise_exception=True)
        dcg = validator.update(dcg, validator.validated_data)
        assert dcg.conditions.count() == 2

        conditions = dcg.conditions.all()
        condition1 = conditions[0]
        condition2 = conditions[1]

        assert condition1.type == Condition.EQUAL
        assert condition1.comparison == 2
        assert condition1.condition_group == dcg

        assert condition2.type == Condition.NOT_EQUAL
        assert condition2.comparison == 5
        assert condition2.condition_group == dcg
