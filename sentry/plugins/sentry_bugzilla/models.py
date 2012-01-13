"""
sentry.plugins.sentry_bugzilla.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django import forms

from sentry.plugins import Plugin


class BugzillaConfigurationForm(forms.Form):
    url = forms.CharField(max_length=128)
    product = forms.CharField(max_length=128)


class BugzillaSubmitForm(forms.Form):
    subject = forms.CharField(max_length=256)
    description = forms.CharField()
    version = forms.CharField(max_length=64)


class CreateBugzillaIssue(Plugin):
    title = 'Create Bugzilla Issue'
    slug = 'create-bugzilla-issue'

    conf_title = 'Bugzilla'
    conf_key = 'bugzilla'
    site_conf_form = BugzillaConfigurationForm
    site_conf_template = 'sentry/plugins/bugzilla/site_configuration.html'
