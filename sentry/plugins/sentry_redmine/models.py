from django import forms
from django.core.context_processors import csrf
from django.db import models
from django.shortcuts import render_to_response
from django.utils import simplejson

from sentry.helpers import urlread
from sentry.models import GroupedMessage
from sentry.plugins import GroupActionProvider, GroupListProvider

import conf

import urllib
import urllib2

class RedmineIssue(models.Model):
    group = models.ForeignKey(GroupedMessage)
    issue_id = models.PositiveIntegerField()

class RedmineIssueForm(forms.Form):
    subject = forms.CharField(max_length=200)
    description = forms.CharField(widget=forms.Textarea())

class CreateRedmineIssue(GroupActionProvider):
    title = 'Create Redmine Issue'
    
    def view(self, request, group):
        if request.POST:
            form = RedmineIssueForm(request.POST)
            if form.is_valid():
                data = simplejson.dumps({
                    'issue': {
                        'subject': form.cleaned_data['subject'],
                        'description': form.cleaned_data['description'],
                    }
                })
                url = conf.REDMINE_URL + '/projects/' + conf.REDMINE_PROJECT_SLUG + '/issues.json'
                
                req = urllib2.Request(url, urllib.urlencode({
                    'key': conf.REDMINE_API_KEY,
                }), headers={
                    'Content-type': 'application/json',
                })
                try:
                    response = urllib2.urlopen(req, data).read()
                except urllib2.HTTPError, e:
                    raise Exception('%s: %s' % (e.code, e.read()))
                
                data = simplejson.loads(response)
                RedmineIssue.objects.create(group=group, issue_id=data['id'])
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

class RedmineTagIssue(GroupListProvider):
    title = 'Redmine Issue IDs'
    
    def before(self, request, group_list):
        self.issues_by_group = dict(RedmineIssue.objects.filter(group__in=group_list).values_list('group', 'issue_id'))
    
    def tags(self, request, group, tags=[]):
        issue_id = self.issues_by_group.get(group.pk)
        if issue_id:
            tags.append(mark_safe('<a href="%s">#%s</a>' % (
                '%sissues/%s' % (conf.REDMINE_URL, issue_id),
                issue_id,
            )))
        return tags