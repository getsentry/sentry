from __future__ import annotations

from typing import Any

from django import forms
from django.utils.translation import ugettext_lazy as _

from sentry.utils import json

from .client import RedmineClient


class RedmineOptionsForm(forms.Form):
    host = forms.URLField(help_text=_("e.g. http://bugs.redmine.org"))
    key = forms.CharField(
        widget=forms.TextInput(attrs={"class": "span9"}),
        help_text="Your API key is available on your account page after enabling the Rest API (Administration -> Settings -> Authentication)",
    )
    project_id = forms.TypedChoiceField(label="Project", coerce=int)
    tracker_id = forms.TypedChoiceField(label="Tracker", coerce=int)
    default_priority = forms.TypedChoiceField(label="Default Priority", coerce=int)
    extra_fields = forms.CharField(
        widget=forms.Textarea(attrs={"rows": 5, "class": "span9"}),
        help_text="Extra attributes (custom fields, status id, etc.) in JSON format",
        label="Extra Fields",
        required=False,
    )

    def __init__(self, data=None, *args, **kwargs):
        super().__init__(data=data, *args, **kwargs)

        initial = kwargs.get("initial") or {}
        for key, value in self.data.items():
            initial[key.lstrip(self.prefix or "")] = value

        has_credentials = all(initial.get(k) for k in ("host", "key"))
        client = None
        if has_credentials:
            client = RedmineClient(initial["host"], initial["key"])
            try:
                projects = client.get_projects()
            except Exception:
                has_credentials = False
            else:
                project_choices = [
                    (p["id"], "{} ({})".format(p["name"], p["identifier"]))
                    for p in projects["projects"]
                ]
                self.fields["project_id"].choices = project_choices

        if client is not None and has_credentials:
            try:
                trackers = client.get_trackers()
            except Exception:
                del self.fields["tracker_id"]
            else:
                tracker_choices = [(p["id"], p["name"]) for p in trackers["trackers"]]
                self.fields["tracker_id"].choices = tracker_choices

            try:
                priorities = client.get_priorities()
            except Exception:
                del self.fields["default_priority"]
            else:
                tracker_choices = [(p["id"], p["name"]) for p in priorities["issue_priorities"]]
                self.fields["default_priority"].choices = tracker_choices

        if not has_credentials:
            del self.fields["project_id"]
            del self.fields["tracker_id"]
            del self.fields["default_priority"]

    def clean(self) -> dict[str, Any] | None:
        cd = self.cleaned_data
        if cd.get("host") and cd.get("key"):
            client = RedmineClient(cd["host"], cd["key"])
            try:
                client.get_projects()
            except Exception:
                raise forms.ValidationError("There was an issue authenticating with Redmine")
        return cd

    def clean_host(self):
        """
        Strip forward slashes off any url passed through the form.
        """
        url = self.cleaned_data.get("host")
        if url:
            return url.rstrip("/")
        return url

    def clean_extra_fields(self):
        """
        Ensure that the value provided is either a valid JSON dictionary,
        or the empty string.
        """
        extra_fields_json = self.cleaned_data.get("extra_fields").strip()
        if not extra_fields_json:
            return ""

        try:
            extra_fields_dict = json.loads(extra_fields_json)
        except ValueError:
            raise forms.ValidationError("Invalid JSON specified")

        if not isinstance(extra_fields_dict, dict):
            raise forms.ValidationError("JSON dictionary must be specified")
        return json.dumps(extra_fields_dict, indent=4)


class RedmineNewIssueForm(forms.Form):
    title = forms.CharField(max_length=200, widget=forms.TextInput(attrs={"class": "span9"}))
    description = forms.CharField(widget=forms.Textarea(attrs={"class": "span9"}))
