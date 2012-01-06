"""
sentry.plugins.sentry_redmine.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from sentry.plugins import GroupActionProvider

from django import forms
from django.db import models
from django.template.loader import render_to_string
from django.template import RequestContext


class BugzillaServer(models.Model):
    url = models.CharField(max_length=128)
    product = models.CharField(max_length=128)


class BugzillaConfigurationForm(forms.ModelForm):
    class Meta:
        model = BugzillaServer


class BugzillaSubmitForm(forms.Form):
    subject = forms.CharField(max_length=256)
    description = forms.CharField()
    version = forms.CharField(max_length=64)


class CreateBugzillaIssue(GroupActionProvider):
    title = 'Create Bugzilla Issue'
    slug = 'create-bugzilla-issue'
    site_config_title = 'Bugzilla'

    @classmethod
    def global_setting_view(cls, request):
        """
        Configure the plugin per project.

        If the request was a POST and the data were processed here then we
        return True to redirect.
        Otherwise just return the view to display.
        """
        try:
            instance = BugzillaServer.objects.all()[0]
        except:
            instance = None
        form = BugzillaConfigurationForm(
            request.POST or None,
            instance=instance,
            prefix="bugzilla"
        )
        if form.is_valid():
            form.save()
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
