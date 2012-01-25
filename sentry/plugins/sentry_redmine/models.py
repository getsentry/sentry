"""
sentry.plugins.sentry_redmine.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from django import forms
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.db import models
from django.http import HttpResponseRedirect
from django.utils.safestring import mark_safe

from sentry.models import Group
from sentry.plugins import Plugin
from sentry.plugins.sentry_redmine import conf
from sentry.utils import json

import base64
import urllib
import urllib2


class RedmineIssue(models.Model):
    group = models.ForeignKey(Group)
    issue_id = models.PositiveIntegerField()


class RedmineIssueForm(forms.Form):
    subject = forms.CharField(max_length=200)
    description = forms.CharField(widget=forms.Textarea())


class CreateRedmineIssue(Plugin):
    title = 'Create Redmine Issue'

    def actions(self, request, group, action_list, **kwargs):
        if 'redmine' not in group.data:
            action_list.append((self.title, self.get_url(group)))
        return action_list

    def view(self, request, group, **kwargs):
        if request.POST:
            form = RedmineIssueForm(request.POST)
            if form.is_valid():
                data = json.dumps({
                    'key': conf.REDMINE_API_KEY,
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

                if conf.REDMINE_USERNAME and conf.REDMINE_PASSWORD:
                    authstring = base64.encodestring('%s:%s' % (conf.REDMINE_USERNAME, conf.REDMINE_PASSWORD))[:-1]
                    req.add_header("Authorization", "Basic %s" % authstring)

                try:
                    response = urllib2.urlopen(req, data).read()
                except urllib2.HTTPError, e:
                    if e.code == 422:
                        data = json.loads(e.read())
                        form.errors['__all__'] = 'Missing or invalid data'
                        for message in data:
                            for k, v in message.iteritems():
                                if k in form.fields:
                                    form.errors.setdefault(k, []).append(v)
                                else:
                                    form.errors['__all__'] += '; %s: %s' % (k, v)
                    else:
                        form.errors['__all__'] = 'Bad response from Redmine: %s %s' % (e.code, e.msg)
                except urllib2.URLError, e:
                    form.errors['__all__'] = 'Unable to reach Redmine host: %s' % (e.reason,)
                else:
                    data = json.loads(response)
                    RedmineIssue.objects.create(group=group, issue_id=data['issue']['id'])
                    group.data['redmine'] = {'issue_id': data['issue']['id']}
                    group.save()
                    return HttpResponseRedirect(reverse('sentry-group', args=[group.project.pk, group.pk]))
        else:
            description = 'Sentry Message: %s' % request.build_absolute_uri(group.get_absolute_url())
            description += '\n\n<pre>' + (group.traceback or group.message) + '</pre>'

            form = RedmineIssueForm(initial={
                'subject': group.error(),
                'description': description,
            })

        context = {
            'form': form,
            'global_errors': form.errors.get('__all__'),
            'BASE_TEMPLATE': 'sentry/groups/details.html',
        }
        context.update(csrf(request))

        return self.render('sentry/plugins/redmine/create_issue.html', context)

    def tags(self, request, group, tag_list):
        if 'redmine' in group.data:
            issue_id = group.data['redmine']['issue_id']
            tag_list.append(mark_safe('<a href="%s">#%s</a>' % (
                '%s/issues/%s' % (conf.REDMINE_URL, issue_id),
                issue_id,
            )))
        return tag_list
