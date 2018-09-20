from __future__ import absolute_import

import re

from django import forms
from sentry.rules.actions.base import PostProcessAction


class FingerprintForm(forms.Form):
    fingerprint = forms.TextField()


class FingerprintEventAction(PostProcessAction):
    form_cls = FingerprintForm
    label = 'Set the default fingerprint to {fingerprint}'

    def after(self, state):
        data = state.data
        new_fingerprint = self.get_option('fingerprint')

        current_fingerprint = data.get('fingerprint')
        if not current_fingerprint:
            current_fingerprint = ['{{ default }}']

        data['fingerprint'] = [
            re.sub(r'\{\{\s?default\s?\}\}', f, new_fingerprint) for f in current_fingerprint
        ]
        return data, True
