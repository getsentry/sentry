from django import forms
from django.core.context_processors import csrf
from django.db import models
from django.shortcuts import render_to_response
from django.utils import simplejson

from sentry.helpers import urlread
from sentry.models import GroupedMessage
from sentry.plugins import GroupActionProvider

import conf

class RedmineIssue(models.Model):
    group = models.ForeignKey(GroupedMessage)
    issue_id = models.PositiveIntegerField()

class RedmineIssueForm(forms.Form):
    subject = forms.CharField(max_length=200)
    description = forms.CharField(widget=forms.Textarea())

class CreateRedmineIssue(GroupActionProvider):
    title = 'Create Redmine Issue'
    
    def perform(self, request, group):
        if request.POST:
            form = RedmineIssueForm(request.POST)
            if form.is_valid():
                data = {
                    'key': conf.REDMINE_API_KEY,
                    'project_id': conf.REDMINE_PROJECT_ID,
                    'subject': form.cleaned_data['subject'],
                    'description': form.cleaned_data['description']
                }
                response = urlread(conf.REDMINE_URL + '/issues.json', POST=data)
                print response
                #RedmineIssue.objects.create(group=group, issue_id=response['issue_id'])
                
        else:
            description = 'Sentry Message: %s' % request.build_absolute_uri(group.get_absolute_url())
            description += '\n\n' + (group.traceback or group.message)

            form = RedmineIssueForm(initial={
                'subject': group.error(),
                'description': description,
            })

        BASE_TEMPLATE = "sentry/group/details.html"

        context = locals()
        context.update(csrf(request))

        return render_to_response('sentry/plugins/redmine/create_issue.html', context)