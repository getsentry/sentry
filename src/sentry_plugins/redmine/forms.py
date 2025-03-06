from __future__ import annotations

from django import forms


class RedmineNewIssueForm(forms.Form):
    title = forms.CharField(max_length=200, widget=forms.TextInput(attrs={"class": "span9"}))
    description = forms.CharField(widget=forms.Textarea(attrs={"class": "span9"}))
