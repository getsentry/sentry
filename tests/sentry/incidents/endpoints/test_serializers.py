from __future__ import absolute_import

from exam import fixture

from sentry.incidents.endpoints.serializers import AlertRuleSerializer
from sentry.incidents.models import (
    AlertRuleAggregations,
    AlertRuleThresholdType,
)
from sentry.testutils import TestCase


class TestAlertRuleSerializer(TestCase):
    @fixture
    def valid_params(self):
        return {
            'name': 'something',
            'time_window': 10,
            'query': 'hi',
            'threshold_type': 0,
            'resolve_threshold': 1,
            'alert_threshold': 0,
            'aggregations': [0],
        }

    def run_fail_validation_test(self, params, errors):
        base_params = self.valid_params.copy()
        base_params.update(params)
        serializer = AlertRuleSerializer(context={'project': self.project}, data=base_params)
        assert not serializer.is_valid()
        assert serializer.errors == errors

    def test_validation_no_params(self):
        serializer = AlertRuleSerializer(context={'project': self.project}, data={})
        assert not serializer.is_valid()
        field_is_required = ['This field is required.']
        assert serializer.errors == {
            'name': field_is_required,
            'timeWindow': field_is_required,
            'query': field_is_required,
            'thresholdType': field_is_required,
            'resolveThreshold': field_is_required,
            'alertThreshold': field_is_required,
            'aggregations': field_is_required,
        }

    def test_time_window(self):
        self.run_fail_validation_test(
            {'timeWindow': 'a'},
            {'timeWindow': ['A valid integer is required.']},
        )
        self.run_fail_validation_test(
            {'timeWindow': 1441},
            {'timeWindow': ['Ensure this value is less than or equal to 1440.']},
        )
        self.run_fail_validation_test(
            {'timeWindow': 0},
            {'timeWindow': ['Ensure this value is greater than or equal to 1.']},
        )

    def test_threshold_type(self):
        invalid_values = ['Invalid threshold type, valid values are %s' % [
            item.value for item in AlertRuleThresholdType
        ]]
        self.run_fail_validation_test(
            {'thresholdType': 'a'},
            {'thresholdType': ['A valid integer is required.']},
        )
        self.run_fail_validation_test(
            {'thresholdType': 50},
            {'thresholdType': invalid_values},
        )

    def test_aggregations(self):
        invalid_values = ['Invalid aggregation, valid values are %s' % [
            item.value for item in AlertRuleAggregations
        ]]
        self.run_fail_validation_test(
            {'aggregations': ['a']},
            {'aggregations': ['A valid integer is required.']},
        )
        self.run_fail_validation_test(
            {'aggregations': [50]},
            {'aggregations': invalid_values},
        )
