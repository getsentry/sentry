from __future__ import absolute_import

from collections import OrderedDict
from django import forms

from sentry import tagstore
from sentry.api.serializers.models.project import bulk_fetch_project_latest_releases
from sentry.rules.conditions.base import EventCondition
from sentry.signals import release_created
from sentry.utils.cache import cache


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


def get_project_release_cache_key(project_id):
    return u"project:{}:latest_release".format(project_id)


@release_created.connect(weak=False)
def clear_project_release_cache(release, **kwargs):
    release_project_ids = release.projects.values_list("id", flat=True)
    for proj_id in release_project_ids:
        cache.delete(get_project_release_cache_key(proj_id))


class TaggedEventForm(forms.Form):
    key = forms.CharField(widget=forms.TextInput())
    match = forms.ChoiceField(MATCH_CHOICES.items(), widget=forms.Select())
    value = forms.CharField(widget=forms.TextInput(), required=False)

    def clean(self):
        super(TaggedEventForm, self).clean()

        key = self.cleaned_data.get("key")
        match = self.cleaned_data.get("match")
        value = self.cleaned_data.get("value")

        if match not in (MatchType.IS_SET, MatchType.NOT_SET) and not value:
            raise forms.ValidationError("This field is required.")

        if (
            key == "release"
            and value == "latest"
            and match
            not in (MatchType.EQUAL, MatchType.NOT_EQUAL, MatchType.IS_SET, MatchType.NOT_SET)
        ):
            raise forms.ValidationError(
                "When matching on latest release you must use 'equals' or 'does not equal'"
            )


class TaggedEventCondition(EventCondition):
    form_cls = TaggedEventForm
    label = u"An event's tags match {key} {match} {value}"

    form_fields = {
        "key": {"type": "string", "placeholder": "key"},
        "match": {"type": "choice", "choices": MATCH_CHOICES.items()},
        "value": {"type": "string", "placeholder": "value"},
    }

    def get_latest_release(self, event):
        cache_key = get_project_release_cache_key(event.group.project_id)
        latest_release = cache.get(cache_key)
        if not latest_release:
            latest_releases = bulk_fetch_project_latest_releases([event.group.project])
            if latest_releases:
                cache.set(cache_key, latest_releases[0], 600)
                return latest_releases[0]
        return latest_release

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

        # specific case to handle if the user wants to match 'release equals latest'
        if key == "release" and value == "latest":
            latest_release = self.get_latest_release(event)
            if not latest_release:
                return False

            if match == MatchType.EQUAL:
                ret_value = True
            elif match == MatchType.NOT_EQUAL:
                ret_value = False
            else:
                return False

            for t_value in values:
                if t_value == latest_release.version:
                    return ret_value
            return not ret_value

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
