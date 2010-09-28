from django.db import models
from django.shortcuts import render_to_response

from sentry.models import GroupedMessage
from sentry.plugins import GroupActionProvider

class RedmineIssue(models.Model):
    group = models.ForeignKey(GroupedMessage)
    issue_id = models.PositiveIntegerField()

class CreateRedmineIssue(GroupActionProvider):
    title = 'Create Redmine Issue'
    
    def perform(self, request, group):
        if request.POST:
            response = '...'

            RedmineIssue.objects.create(group=group, issue_id=response['issue_id'])

        return render_to_response('sentry/plugins/redmine/create_issue.html', locals())