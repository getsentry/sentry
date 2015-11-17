"""
sentry.rules.conditions.tagged_event
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import json

from collections import OrderedDict
from django import forms

from sentry.rules.conditions.base import EventCondition


class MatchType(object):
    EQUAL = 'eq'
    NOT_EQUAL = 'ne'
    STARTS_WITH = 'sw'
    ENDS_WITH = 'ew'
    CONTAINS = 'co'
    NOT_CONTAINS = 'nc'
    IS_SET = 'is'
    NOT_SET = 'ns'


MATCH_CHOICES = OrderedDict([
    (MatchType.EQUAL, 'equals'),
    (MatchType.NOT_EQUAL, 'does not equal'),
    (MatchType.STARTS_WITH, 'starts with'),
    (MatchType.ENDS_WITH, 'ends with'),
    (MatchType.CONTAINS, 'contains'),
    (MatchType.NOT_CONTAINS, 'does not contain'),
    (MatchType.IS_SET, 'is set'),
    (MatchType.NOT_SET, 'is not set'),
])

ATTR_CHOICES = [
    'message',
    'platform',
    'exception.type',
    'exception.value',
    'user.id',
    'user.email',
    'user.username',
    'user.ip_address',
    'http.method',
    'http.url',
    'stacktrace.code',
    'stacktrace.module',
    'stacktrace.filename',
]


class FixedTypeaheadInput(forms.TextInput):
    def __init__(self, choices, *args, **kwargs):
        super(FixedTypeaheadInput, self).__init__(*args, **kwargs)
        self.attrs['data-choices'] = json.dumps(choices)
        self.attrs['class'] = self.attrs.get('class', '') + ' typeahead'


class EventAttributeForm(forms.Form):
    attribute = forms.CharField(widget=FixedTypeaheadInput(
        attrs={'style': 'width:200px', 'placeholder': 'i.e. exception.type'},
        choices=[{'id': a, 'text': a} for a in ATTR_CHOICES],
    ))
    match = forms.ChoiceField(MATCH_CHOICES.items(), widget=forms.Select(
        attrs={'style': 'width:150px'},
    ))
    value = forms.CharField(widget=forms.TextInput(
        attrs={'placeholder': 'value'},
    ), required=False)


class EventAttributeCondition(EventCondition):
    """
    Attributes are a mapping of <logical-key>.<property>.

    For example:

    - message
    - platform
    - exception.{type,value}
    - user.{id,ip_address,email,FIELD}
    - http.{method,url}
    - stacktrace.{code,module,filename}
    - extra.{FIELD}
    """
    # TODO(dcramer): add support for stacktrace.vars.[name]

    form_cls = EventAttributeForm
    label = 'An events {attribute} value {match} {value}'

    def _get_attribute_values(self, event, attr):
        # TODO(dcramer): we should validate attributes (when we can) before

        path = attr.split('.')

        if path[0] in ('message', 'platform'):
            if len(path) != 1:
                return []
            return [getattr(event, path[0])]

        elif len(path) == 1:
            return []

        elif path[0] == 'extra':
            path.pop(0)
            value = event.data['extra']
            while path:
                bit = path.pop(0)
                value = value.get(bit)
                if not value:
                    return []

            if isinstance(value, (list, tuple)):
                return value
            return [value]

        elif len(path) != 2:
            return []

        elif path[0] == 'exception':
            if path[1] not in ('type', 'value'):
                return []

            return [
                getattr(e, path[1])
                for e in event.interfaces['sentry.interfaces.Exception'].values
            ]

        elif path[0] == 'user':
            if path[1] in ('id', 'ip_address', 'email', 'username'):
                return [
                    getattr(event.interfaces['sentry.interfaces.User'], path[1])
                ]
            return [
                getattr(event.interfaces['sentry.interfaces.User'].data, path[1])
            ]

        elif path[0] == 'http':
            if path[1] not in ('url', 'method'):
                return []

            return [
                getattr(event.interfaces['sentry.interfaces.Http'], path[1])
            ]

        elif path[0] == 'stacktrace':
            stacks = event.interfaces.get('sentry.interfaces.Stacktrace')
            if stacks:
                stacks = [stacks]
            else:
                stacks = [
                    e.stacktrace
                    for e in event.interfaces['sentry.interfaces.Exception'].values
                ]

            result = []
            for st in stacks:
                for frame in st.frames:
                    if path[1] in ('filename', 'module'):
                        result.append(getattr(frame, path[1]))
                    elif path[1] == 'code':
                        if frame.pre_context:
                            result.extend(frame.pre_context)
                        if frame.context_line:
                            result.append(frame.context_line)
                        if frame.post_context:
                            result.extend(frame.post_context)
            return result
        return []

    def render_label(self):
        data = {
            'attribute': self.data['attribute'],
            'value': self.data['value'],
            'match': MATCH_CHOICES[self.data['match']],
        }
        return self.label.format(**data)

    def passes(self, event, state, **kwargs):
        attr = self.get_option('attribute')
        match = self.get_option('match')
        value = self.get_option('value')

        if not (attr and match and value):
            return False

        value = value.lower()
        attr = attr.lower()

        try:
            attribute_values = self._get_attribute_values(event, attr)
        except KeyError:
            attribute_values = []

        attribute_values = [v.lower() for v in attribute_values if v is not None]

        if match == MatchType.EQUAL:
            for a_value in attribute_values:
                if a_value == value:
                    return True
            return False

        elif match == MatchType.NOT_EQUAL:
            for a_value in attribute_values:
                if a_value == value:
                    return False
            return True

        elif match == MatchType.STARTS_WITH:
            for a_value in attribute_values:
                if a_value.startswith(value):
                    return True
            return False

        elif match == MatchType.ENDS_WITH:
            for a_value in attribute_values:
                if a_value.endswith(value):
                    return True
            return False

        elif match == MatchType.CONTAINS:
            for a_value in attribute_values:
                if value in a_value:
                    return True
            return False

        elif match == MatchType.NOT_CONTAINS:
            for a_value in attribute_values:
                if value in a_value:
                    return False
            return True

        elif match == MatchType.IS_SET:
            return bool(attribute_values)

        elif match == MatchType.NOT_SET:
            return not attribute_values
