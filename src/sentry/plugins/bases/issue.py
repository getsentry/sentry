"""
sentry.plugins.bases.issue
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from django import forms
from django.conf import settings
from django.utils.html import format_html
from social_auth.models import UserSocialAuth

from sentry.models import (
    Activity,
    Event,
    GroupMeta,
)
from sentry.plugins import Plugin
from sentry.signals import issue_tracker_used
from sentry.utils.auth import get_auth_providers
from sentry.utils.http import absolute_uri
from sentry.utils.safe import safe_execute


class NewIssueForm(forms.Form):
    title = forms.CharField(max_length=200, widget=forms.TextInput(attrs={'class': 'span9'}))
    description = forms.CharField(widget=forms.Textarea(attrs={'class': 'span9'}))


class IssueTrackingPlugin(Plugin):
    # project_conf_form = BaseIssueOptionsForm
    new_issue_form = NewIssueForm
    link_issue_form = None

    create_issue_template = 'sentry/plugins/bases/issue/create_issue.html'
    not_configured_template = 'sentry/plugins/bases/issue/not_configured.html'
    needs_auth_template = 'sentry/plugins/bases/issue/needs_auth.html'
    auth_provider = None
    can_unlink_issues = False
    can_link_existing_issues = False

    def _get_group_body(self, request, group, event, **kwargs):
        result = []
        for interface in six.itervalues(event.interfaces):
            output = safe_execute(interface.to_string, event, _with_transaction=False)
            if output:
                result.append(output)
        return '\n\n'.join(result)

    def _get_group_description(self, request, group, event):
        output = [
            absolute_uri(group.get_absolute_url()),
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

    def is_configured(self, request, project, **kwargs):
        raise NotImplementedError

    def get_auth_for_user(self, user, **kwargs):
        """
        Return a ``UserSocialAuth`` object for the given user based on this plugins ``auth_provider``.
        """
        assert self.auth_provider, 'There is no auth provider configured for this plugin.'

        if not user.is_authenticated():
            return None

        try:
            return UserSocialAuth.objects.filter(user=user, provider=self.auth_provider)[0]
        except IndexError:
            return None

    def needs_auth(self, request, project, **kwargs):
        """
        Return ``True`` if the authenticated user needs to associate an auth service before
        performing actions with this plugin.
        """
        if self.auth_provider is None:
            return False

        if not request.user.is_authenticated():
            return True

        return bool(not UserSocialAuth.objects.filter(user=request.user, provider=self.auth_provider).exists())

    def get_new_issue_title(self, **kwargs):
        """
        Return a string for the "Create new issue" action label.
        """
        return 'Create %s Issue' % self.get_title()

    def get_unlink_issue_title(self, **kwargs):
        """
        Return a string for the "Unlink plugin issue" action label.
        """
        return 'Unlink %s Issue' % self.get_title()

    def get_new_issue_form(self, request, group, event, **kwargs):
        """
        Return a Form for the "Create new issue" page.
        """
        return self.new_issue_form(request.POST or None, initial=self.get_initial_form_data(request, group, event))

    def get_new_issue_read_only_fields(self, *args, **kwargs):
        """
        Return a list of additional read only fields that are helpful to
        know when filing the issue.
        """
        return []

    def get_link_existing_issue_form(self, request, group, event, **kwargs):
        if not self.link_issue_form:
            return None
        return self.link_issue_form(request.POST or None,
                                    initial=self.get_initial_link_form_data(request, group, event))

    def get_issue_url(self, group, issue_id, **kwargs):
        """
        Given an issue_id (string) return an absolute URL to the issue's details
        page.
        """
        raise NotImplementedError

    def get_issue_title_by_id(self, request, group, issue_id):
        """
        Given an issue_id return the issue's title.
        """
        raise NotImplementedError

    def get_issue_label(self, group, issue_id, **kwargs):
        """
        Given an issue_id (string) return a string representing the issue.

        e.g. GitHub represents issues as GH-XXX
        """
        return '#%s' % issue_id

    def create_issue(self, request, group, form_data, **kwargs):
        """
        Creates the issue on the remote service and returns an issue ID.
        """
        raise NotImplementedError

    def link_issue(self, request, group, form_data, **kwargs):
        """
        Can be overridden for any actions needed when linking issues
        (like adding a comment to an existing issue).
        """
        pass

    def get_initial_form_data(self, request, group, event, **kwargs):
        return {
            'description': self._get_group_description(request, group, event),
            'title': self._get_group_title(request, group, event),
        }

    def get_initial_link_form_data(self, request, group, event, **kwargs):
        return {}

    def has_auth_configured(self, **kwargs):
        if not self.auth_provider:
            return True

        return self.auth_provider in get_auth_providers()

    def handle_unlink_issue(self, request, group, **kwargs):
        GroupMeta.objects.unset_value(group, '%s:tid' % self.get_conf_key())
        return self.redirect(group.get_absolute_url())

    def view(self, request, group, **kwargs):
        has_auth_configured = self.has_auth_configured()
        if not (has_auth_configured and self.is_configured(project=group.project, request=request)):
            if self.auth_provider:
                required_auth_settings = settings.AUTH_PROVIDERS[self.auth_provider]
            else:
                required_auth_settings = None

            return self.render(self.not_configured_template, {
                'title': self.get_title(),
                'project': group.project,
                'has_auth_configured': has_auth_configured,
                'required_auth_settings': required_auth_settings,
            })

        if self.needs_auth(project=group.project, request=request):
            return self.render(self.needs_auth_template, {
                'title': self.get_title(),
                'project': group.project,
            })

        if GroupMeta.objects.get_value(group, '%s:tid' % self.get_conf_key(), None):
            if self.can_unlink_issues and request.GET.get('unlink'):
                return self.handle_unlink_issue(request, group, **kwargs)
            return None

        prefix = self.get_conf_key()
        event = group.get_latest_event()
        Event.objects.bind_nodes([event], 'data')

        op = request.POST.get('op', 'create')

        create_form = self.get_new_issue_form(request, group, event)
        link_form = None
        if self.can_link_existing_issues:
            link_form = self.get_link_existing_issue_form(request, group, event)

        if op == 'create':
            if create_form.is_valid():
                try:
                    issue_id = self.create_issue(
                        group=group,
                        form_data=create_form.cleaned_data,
                        request=request,
                    )
                except forms.ValidationError as e:
                    create_form.errors['__all__'] = [u'Error creating issue: %s' % e]

            if create_form.is_valid():
                GroupMeta.objects.set_value(group, '%s:tid' % prefix, issue_id)

                issue_information = {
                    'title': create_form.cleaned_data['title'],
                    'provider': self.get_title(),
                    'location': self.get_issue_url(group, issue_id),
                    'label': self.get_issue_label(group=group, issue_id=issue_id),
                }
                Activity.objects.create(
                    project=group.project,
                    group=group,
                    type=Activity.CREATE_ISSUE,
                    user=request.user,
                    data=issue_information,
                )

                issue_tracker_used.send(plugin=self, project=group.project, user=request.user, sender=IssueTrackingPlugin)
                return self.redirect(group.get_absolute_url())

        elif op == 'link':
            if link_form.is_valid():
                try:
                    self.link_issue(
                        group=group,
                        form_data=link_form.cleaned_data,
                        request=request,
                    )
                except forms.ValidationError as e:
                    link_form.errors['__all__'] = [u'Error creating issue: %s' % e]

            if link_form.is_valid():
                issue_id = int(link_form.cleaned_data['issue_id'])
                GroupMeta.objects.set_value(group, '%s:tid' % prefix, issue_id)
                issue_information = {
                    'title': self.get_issue_title_by_id(request, group, issue_id),
                    'provider': self.get_title(),
                    'location': self.get_issue_url(group, issue_id),
                    'label': self.get_issue_label(group=group, issue_id=issue_id),
                }
                Activity.objects.create(
                    project=group.project,
                    group=group,
                    type=Activity.CREATE_ISSUE,
                    user=request.user,
                    data=issue_information,
                )

                return self.redirect(group.get_absolute_url())

        context = {
            'create_form': create_form,
            # pass in 'form' for legacy compat
            'form': create_form,
            'title': self.get_new_issue_title(),
            'read_only_fields': self.get_new_issue_read_only_fields(group=group),
            'can_link_existing_issues': self.can_link_existing_issues,
            'link_form': link_form,
            'op': op
        }

        return self.render(self.create_issue_template, context)

    def actions(self, request, group, action_list, **kwargs):
        if not self.is_configured(request=request, project=group.project):
            return action_list
        prefix = self.get_conf_key()
        if not GroupMeta.objects.get_value(group, '%s:tid' % prefix, None):
            action_list.append((self.get_new_issue_title(), self.get_url(group)))
        elif self.can_unlink_issues:
            action_list.append((self.get_unlink_issue_title(),
                                '%s?unlink=1' % self.get_url(group).rstrip('/')))
        return action_list

    def tags(self, request, group, tag_list, **kwargs):
        if not self.is_configured(request=request, project=group.project):
            return tag_list

        prefix = self.get_conf_key()
        issue_id = GroupMeta.objects.get_value(group, '%s:tid' % prefix)
        if not issue_id:
            return tag_list

        tag_list.append(format_html('<a href="{}" rel="noreferrer">{}</a>',
            self.get_issue_url(group=group, issue_id=issue_id),
            self.get_issue_label(group=group, issue_id=issue_id),
        ))

        return tag_list

    def get_issue_doc_html(self, **kwargs):
        return ""

IssuePlugin = IssueTrackingPlugin
