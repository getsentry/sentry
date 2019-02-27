from __future__ import absolute_import

import six

from collections import OrderedDict
from croniter import croniter
from django.core.exceptions import ValidationError
from rest_framework import serializers

from sentry.models import MonitorStatus, MonitorType, ScheduleType
from sentry.api.serializers.rest_framework.project import ProjectField


SCHEDULE_TYPES = OrderedDict([
    ('crontab', ScheduleType.CRONTAB),
    ('interval', ScheduleType.INTERVAL),
])

MONITOR_TYPES = OrderedDict([
    ('cron_job', MonitorType.CRON_JOB),
])

MONITOR_STATUSES = OrderedDict([
    ('active', MonitorStatus.ACTIVE),
    ('disabled', MonitorStatus.DISABLED),
])

INTERVAL_NAMES = ('year', 'month', 'week', 'day', 'hour', 'minute')

# XXX(dcramer): @reboot is not supported (as it cannot be)
NONSTANDARD_CRONTAB_SCHEDULES = {
    '@yearly': '0 0 1 1 *',
    '@annually': '0 0 1 1 *',
    '@monthly': '0 0 1 * *',
    '@weekly': '0 0 * * 0',
    '@daily': '0 0 * * *',
    '@hourly': '0 * * * *',
}


class CronJobValidator(serializers.Serializer):
    schedule_type = serializers.ChoiceField(
        choices=zip(SCHEDULE_TYPES.keys(), SCHEDULE_TYPES.keys()),
    )
    schedule = serializers.WritableField()
    checkin_margin = serializers.IntegerField(required=False)
    max_runtime = serializers.IntegerField(required=False)

    def validate_schedule_type(self, attrs, source):
        value = attrs[source]
        if value:
            attrs[source] = SCHEDULE_TYPES[value]
        return attrs

    def validate_schedule(self, attrs, source):
        if 'schedule_type' in attrs:
            schedule_type = attrs['schedule_type']
        else:
            schedule_type = self.object['schedule_type']

        value = attrs[source]
        if not value:
            return attrs

        if schedule_type == ScheduleType.INTERVAL:
            # type: [int count, str unit name]
            if not isinstance(value, list):
                raise ValidationError('Invalid value for schedule_type')
            if not isinstance(value[0], int):
                raise ValidationError('Invalid value for schedule unit count (index 0)')
            if value[1] not in INTERVAL_NAMES:
                raise ValidationError('Invalid value for schedlue unit name (index 1)')
        elif schedule_type == ScheduleType.CRONTAB:
            # type: str schedule
            if not isinstance(value, six.string_types):
                raise ValidationError('Invalid value for schedule_type')
            value = value.strip()
            if value.startswith('@'):
                try:
                    value = NONSTANDARD_CRONTAB_SCHEDULES[value]
                except KeyError:
                    raise ValidationError('Schedule was not parseable')
            if not croniter.is_valid(value):
                raise ValidationError('Schedule was not parseable')
            attrs[source] = value
        return attrs


class MonitorValidator(serializers.Serializer):
    project = ProjectField()
    name = serializers.CharField()
    status = serializers.ChoiceField(
        choices=zip(MONITOR_STATUSES.keys(), MONITOR_STATUSES.keys()),
        default='active',
    )
    type = serializers.ChoiceField(
        choices=zip(MONITOR_TYPES.keys(), MONITOR_TYPES.keys())
    )

    def get_default_fields(self):
        type = self.init_data.get('type', self.object.get('type') if self.object else None)
        if type in MONITOR_TYPES:
            type = MONITOR_TYPES[type]
        if type == MonitorType.CRON_JOB:
            config = CronJobValidator()
        elif not type:
            return {}
        else:
            raise NotImplementedError
        return {'config': config}

    def validate_status(self, attrs, source):
        value = attrs[source]
        if value:
            attrs[source] = MONITOR_STATUSES[value]
        return attrs

    def validate_type(self, attrs, source):
        value = attrs[source]
        if value:
            attrs[source] = MONITOR_TYPES[value]
        return attrs
