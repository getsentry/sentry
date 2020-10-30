from __future__ import absolute_import

import six

from django import forms


def field_to_config(name, field):
    config = {
        "name": name,
        "label": field.label or name.replace("_", " ").title(),
        "placeholder": field.widget.attrs.get("placeholder"),
        "help": field.help_text,
        "required": field.required,
    }
    if isinstance(field, forms.URLField):
        config["type"] = "url"
    elif isinstance(field, forms.IntegerField):
        config["type"] = "number"
    elif isinstance(field, forms.BooleanField):
        config["type"] = "bool"
    elif isinstance(field, forms.EmailField):
        config["type"] = "email"
    elif isinstance(field, forms.CharField):
        if isinstance(field.widget, forms.PasswordInput):
            config["type"] = "secret"
        elif isinstance(field.widget, forms.Textarea):
            config["type"] = "textarea"
        else:
            config["type"] = "text"
    elif isinstance(field, forms.ChoiceField):
        config["type"] = "select"
        config["choices"] = field.choices
    return config


def form_to_config(form):
    config = []
    for name, field in six.iteritems(form.base_fields):
        row = field_to_config(name, field)
        row["default"] = field.initial
        config.append(row)
    return config
