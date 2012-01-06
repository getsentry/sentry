"""
sentry.plugins.sentry_bugzilla.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django import forms
from django.db import models
from django.template.loader import render_to_string
from django.template import RequestContext

from sentry.plugins import Plugin
from sentry.models import Option


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
    site_config_title = 'Bugzilla'

    @classmethod
    def global_setting_view(cls, request, project=None):
        """
        Configure the plugin per project.

        If the request was a POST and the data were processed here then we
        return True to redirect.
        Otherwise just return the view to display.
        """

        initials = {}
        for field in BugzillaConfigurationForm.base_fields:
            key = 'bugzilla:%s' % (field, )
            value = Option.objects.get_value(key, None)
            if value:
                initials[field] = value

        form = BugzillaConfigurationForm(
            request.POST or None,
            initial=initials,
            prefix="bugzilla"
        )
        if form.is_valid():
            for key, value in form.cleaned_data.iteritems():
                option_key = 'bugzilla:%s' % key
                Option.objects.set_value(option_key, value)

            return True

        return render_to_string(
            'sentry/plugins/bugzilla/site_configuration.html', {
            'form': form,
        }, context_instance=RequestContext(request))

    def project_setting_view(self):
        """
        Configure the plugin per project.
        """
        return None
