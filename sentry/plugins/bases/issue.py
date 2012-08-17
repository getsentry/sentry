"""
sentry.plugins.bases.issue
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.models import GroupMeta
from sentry.plugins import Plugin
from django import forms
from django.core.urlresolvers import reverse
from django.utils.html import escape
from django.utils.safestring import mark_safe


class NewIssueForm(forms.Form):
    title = forms.CharField(max_length=200)
    description = forms.CharField(widget=forms.Textarea())


class BaseIssueOptionsForm(forms.Form):
    def __init__(self, plugin, user, *args, **kwargs):
        self.plugin = plugin
        self.user = user
        super(BaseIssueOptionsForm, self).__init__(*args, **kwargs)

    def get_title(self):
        raise NotImplementedError

    def get_description(self):
        return ""

    def save(self):
        raise NotImplementedError


class IssuePlugin(Plugin):
    # project_conf_form = BaseIssueOptionsForm
    new_issue_form = NewIssueForm

    create_issue_template = 'sentry/plugins/bases/issue/create_issue.html'
    not_configured_template = 'sentry/plugins/bases/issue/not_configured.html'

    def __init__(self, *args, **kwargs):
        super(IssuePlugin, self).__init__(*args, **kwargs)
        self._cache = {}

    def _get_group_body(self, request, group, event, **kwargs):
        interface = event.interfaces.get('sentry.interfaces.Stacktrace')
        if interface:
            return interface.to_string(event)
        return

    def _get_group_description(self, request, group, event):
        output = [
            request.build_absolute_uri(group.get_absolute_url()),
        ]
        body = self._get_group_body(request, group, event)
        if body:
            output.extend([
                '',
                '```',
                body,
                '```',
            ])
        return '\n'.join(output)

    def _get_group_title(self, request, group, event):
        return event.error()

    def is_configured(self, project):
        # return all((self.get_option(k, project) for k in ('host', 'username', 'certificate')))
        raise NotImplementedError

    def get_issue_url(self, issue_id):
        raise NotImplementedError

    def get_new_issue_title(self):
        return 'Create %s Issue' % self.get_title()

    def create_issue(self, group, form_data):
        """
        Creates the issue on the remote service and returns an issue ID.
        """
        raise NotImplementedError
        # try:
        #     data = api.maniphest.createtask(
        #         title=form.cleaned_data['title'].encode('utf-8'),
        #         description=form.cleaned_data['description'].encode('utf-8'),
        #     )
        # except phabricator.APIError, e:
        #     form.errors['__all__'] = '%s %s' % (e.code, e.message)
        # except httplib.HTTPException, e:
        #     form.errors['__all__'] = 'Unable to reach Phabricator host: %s' % (e.reason,)
        # else:
        #     return data['id']

    def get_initial_form_data(self, request, group, event):
        return {
            'description': self._get_group_description(request, group, event),
            'title': self._get_group_title(request, group, event),
        }

    def view(self, request, group, **kwargs):
        if not self.is_configured(group.project):
            return self.render(self.not_configured_template)

        prefix = self.get_conf_key()
        event = group.get_latest_event()

        form = self.new_issue_form(request.POST or None, initial=self.get_initial_form_data(request, group, event))
        if form.is_valid():
            try:
                issue_id = self.create_issue(group, form.cleaned_data)
            except forms.ValidationError, e:
                form.errors['__all__'] = u'Error creating issue: %s' % e

        if form.is_valid():
            GroupMeta.objects.set_value(group, '%s:tid' % prefix, issue_id)

            return self.redirect(reverse('sentry-group', args=[group.project_id, group.pk]))

        context = {
            'form': form,
        }

        return self.render(self.create_issue_template, context)

    def actions(self, request, group, action_list, **kwargs):
        prefix = self.get_conf_key()
        if not GroupMeta.objects.get_value(group, '%s:tid' % prefix, None):
            action_list.append((self.get_new_issue_title(), self.get_url(group)))
        return action_list

    def before_events(self, request, event_list, **kwargs):
        prefix = self.get_conf_key()
        self._cache = GroupMeta.objects.get_value_bulk(event_list, '%s:tid' % prefix)

    def tags(self, request, group, tag_list, **kwargs):
        if not self.is_configured(group.project):
            return tag_list

        issue_id = self._cache.get(group.pk)
        if not issue_id:
            return tag_list

        tag_list.append(mark_safe('<a href="%s">#%s</a>' % (
            self.get_issue_url(issue_id),
            escape(issue_id),
        )))

        return tag_list
