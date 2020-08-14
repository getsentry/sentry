from __future__ import absolute_import

from datetime import timedelta
from django import forms
from django.utils import timezone

from sentry.rules.filters.base import EventFilter


class AgeComparisonType(object):
    OLDER = "older"
    NEWER = "newer"


timeranges = {
    "minute": ("minute(s)", timedelta(minutes=1)),
    "hour": ("hour(s)", timedelta(hours=1)),
    "day": ("day(s)", timedelta(days=1)),
    "week": ("week(s)", timedelta(days=7)),
}

age_comparison_choices = [(AgeComparisonType.OLDER, "older"), (AgeComparisonType.NEWER, "newer")]


def get_timerange_choices():
    return [
        (key, label)
        for key, (label, duration) in sorted(
            timeranges.items(), key=lambda key___label__duration: key___label__duration[1][1]
        )
    ]


class NewerOlderForm(forms.Form):
    older_newer = forms.ChoiceField(choices=age_comparison_choices)
    value = forms.IntegerField()
    time = forms.ChoiceField(choices=get_timerange_choices)


class NewerOlderFilter(EventFilter):
    form_cls = NewerOlderForm
    form_fields = {
        "older_newer": {"type": "choice", "choices": age_comparison_choices},
        "value": {"type": "number", "placeholder": 10},
        "time": {"type": "choice", "choices": get_timerange_choices()},
    }

    # An issue is newer/older than X minutes/hours/days/weeks
    label = "An issue is {older_newer} than {value} {time}"

    def passes(self, event, state):
        older_newer = self.get_option("older_newer")
        time = self.get_option("time")
        try:
            value = int(self.get_option("value"))
        except (TypeError, ValueError):
            return False

        if not older_newer or not time or time not in timeranges:
            return False

        _, delta_time = timeranges[time]

        first_seen = event.group.first_seen
        if older_newer == AgeComparisonType.OLDER:
            return first_seen + (value * delta_time) < timezone.now()
        elif older_newer == AgeComparisonType.NEWER:
            return first_seen + (value * delta_time) > timezone.now()
        else:
            return False
