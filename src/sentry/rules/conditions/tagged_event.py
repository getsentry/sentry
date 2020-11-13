from __future__ import absolute_import

from collections import OrderedDict
from django import forms

from sentry import tagstore
from sentry.rules.conditions.base import EventCondition


class MatchType(object):
    EQUAL = "eq"
    NOT_EQUAL = "ne"
    STARTS_WITH = "sw"
    ENDS_WITH = "ew"
    CONTAINS = "co"
    NOT_CONTAINS = "nc"
    IS_SET = "is"
    NOT_SET = "ns"


MATCH_CHOICES = OrderedDict(
    [
        (MatchType.EQUAL, "equals"),
        (MatchType.NOT_EQUAL, "does not equal"),
        (MatchType.STARTS_WITH, "starts with"),
        (MatchType.ENDS_WITH, "ends with"),
        (MatchType.CONTAINS, "contains"),
        (MatchType.NOT_CONTAINS, "does not contain"),
        (MatchType.IS_SET, "is set"),
        (MatchType.NOT_SET, "is not set"),
    ]
)


class TaggedEventForm(forms.Form):
    key = forms.CharField(widget=forms.TextInput())
    match = forms.ChoiceField(list(MATCH_CHOICES.items()), widget=forms.Select())
    value = forms.CharField(widget=forms.TextInput(), required=False)

    def clean(self):
        super(TaggedEventForm, self).clean()

        match = self.cleaned_data.get("match")
        value = self.cleaned_data.get("value")

        if match not in (MatchType.IS_SET, MatchType.NOT_SET) and not value:
            raise forms.ValidationError("This field is required.")


class TaggedEventCondition(EventCondition):
    form_cls = TaggedEventForm
    label = u"The event's tags match {key} {match} {value}"

    form_fields = {
        "key": {"type": "string", "placeholder": "key"},
        "match": {"type": "choice", "choices": list(MATCH_CHOICES.items())},
        "value": {"type": "string", "placeholder": "value"},
    }

    def passes(self, event, state, **kwargs):
        key = self.get_option("key")
        match = self.get_option("match")
        value = self.get_option("value")

        if not (key and match):
            return False

        key = key.lower()

        tags = (
            k
            for gen in (
                (k.lower() for k, v in event.tags),
                (tagstore.get_standardized_key(k) for k, v in event.tags),
            )
            for k in gen
        )

        if match == MatchType.IS_SET:
            return key in tags

        elif match == MatchType.NOT_SET:
            return key not in tags

        if not value:
            return False

        value = value.lower()

        values = (
            v.lower()
            for k, v in event.tags
            if k.lower() == key or tagstore.get_standardized_key(k) == key
        )

        if match == MatchType.EQUAL:
            for t_value in values:
                if t_value == value:
                    return True
            return False

        elif match == MatchType.NOT_EQUAL:
            for t_value in values:
                if t_value == value:
                    return False
            return True

        elif match == MatchType.STARTS_WITH:
            for t_value in values:
                if t_value.startswith(value):
                    return True
            return False

        elif match == MatchType.ENDS_WITH:
            for t_value in values:
                if t_value.endswith(value):
                    return True
            return False

        elif match == MatchType.CONTAINS:
            for t_value in values:
                if value in t_value:
                    return True
            return False

        elif match == MatchType.NOT_CONTAINS:
            for t_value in values:
                if value in t_value:
                    return False
            return True

    def render_label(self):
        data = {
            "key": self.data["key"],
            "value": self.data["value"],
            "match": MATCH_CHOICES[self.data["match"]],
        }
        return self.label.format(**data)
