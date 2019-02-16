from __future__ import absolute_import

import logging

from django.core.urlresolvers import reverse

from sentry.integrations.exceptions import ApiUnauthorized, ApiError, IntegrationError, IntegrationFormError
from sentry.integrations.issues import IssueSyncMixin
from sentry.models import IntegrationExternalProject, OrganizationIntegration, User

logger = logging.getLogger('sentry.integrations.jira')


class JiraIssueSync(IssueSyncMixin):

    def get_link_issue_config(self, group, **kwargs):
        fields = super(JiraIssueSync, self).get_link_issue_config(group, **kwargs)
        org = group.organization
        autocomplete_url = reverse(
            'sentry-extensions-jira-search', args=[org.slug, self.model.id],
        )
        for field in fields:
            if field['name'] == 'externalIssue':
                field['url'] = autocomplete_url
                field['type'] = 'select'
        return fields

    def get_issue_url(self, key, **kwargs):
        return '%s/browse/%s' % (self.model.metadata['base_url'], key)

    def get_issue(self, issue_id, **kwargs):
        client = self.get_client()
        issue = client.get_issue(issue_id)
        return {
            'key': issue_id,
            'title': issue['fields']['summary'],
            'description': issue['fields']['description'],
        }

    def search_issues(self, query):
        try:
            return self.get_client().search_issues(query)
        except ApiError as e:
            self.raise_error(e)

    def get_create_issue_config(self, group, **kwargs):
        kwargs['link_referrer'] = 'jira_integration'
        fields = super(JiraIssueSync, self).get_create_issue_config(group, **kwargs)
        params = kwargs.get('params', {})

        defaults = self.get_project_defaults(group.project_id)
        project_id = params.get('project', defaults.get('project'))

        client = self.get_client()

        # If we don't have a jira project selected, fetch the first project
        # This avoids a potentially very expensive API call to fetch issue
        # create configuration for *all* projects.
        jira_projects = client.get_projects_list()
        if not project_id and len(jira_projects):
            project_id = jira_projects[0]['id']

        meta = self.get_project_meta_for_issue(group, project_id)
        if not meta:
            raise IntegrationError(
                'No projects were found in Jira. Check the permissions for projects.'
            )

        # check if the issuetype was passed as a parameter
        issue_type = params.get('issuetype', defaults.get('issuetype'))
        issue_type_meta = self.get_issue_type_meta(issue_type, meta)
        issue_type_choices = self.make_choices(meta['issuetypes'])

        # make sure default issue type is actually
        # one that is allowed for project
        if issue_type:
            if not any((c for c in issue_type_choices if c[0] == issue_type)):
                issue_type = issue_type_meta['id']

        fields = [
            {
                'name': 'project',
                'label': 'Jira Project',
                'choices': [(p['id'], p['key']) for p in jira_projects],
                'default': meta['id'],
                'type': 'select',
                'updatesForm': True,
            }
        ] + fields + [
            {
                'name': 'issuetype',
                'label': 'Issue Type',
                'default': issue_type or issue_type_meta['id'],
                'type': 'select',
                'choices': issue_type_choices,
                'updatesForm': True,
            }
        ]

        self.update_issue_fields_with_dynamic_fields(group, issue_type_meta, defaults, meta, fields)
        return fields

    def create_issue(self, data, **kwargs):
        client = self.get_client()

        # protect against mis-configured integration submitting a form without an
        # issuetype assigned.
        if not data.get('issuetype'):
            raise IntegrationFormError({'issuetype': ['Issue type is required.']})

        jira_project = data.get('project')
        if not jira_project:
            raise IntegrationFormError({'project': ['Jira project is required']})

        meta = client.get_create_meta_for_project(jira_project)
        if not meta:
            raise IntegrationError('Could not fetch issue create configuration from Jira.')

        issue_type_meta = self.get_issue_type_meta(data['issuetype'], meta)

        cleaned_data = self.clean_create_issue_data(issue_type_meta, data)

        try:
            response = client.create_issue(cleaned_data)
        except Exception as e:
            self.raise_error(e)

        issue_key = response.get('key')
        if not issue_key:
            raise IntegrationError('There was an error creating the issue.')

        issue = client.get_issue(issue_key)

        return {
            'title': issue['fields']['summary'],
            'description': issue['fields']['description'],
            'key': issue_key,
        }

    def sync_assignee_outbound(self, external_issue, user, assign=True, **kwargs):
        """
        Propagate a sentry issue's assignee to a jira issue's assignee
        """
        client = self.get_client()

        jira_user = None
        if assign:
            for ue in user.emails.filter(is_verified=True):
                try:
                    res = client.search_users_for_issue(external_issue.key, ue.email)
                except (ApiUnauthorized, ApiError):
                    continue
                try:
                    jira_user = [
                        r for r in res if r['emailAddress'] == ue.email
                    ][0]
                except IndexError:
                    pass
                else:
                    break

            if jira_user is None:
                # TODO(jess): do we want to email people about these types of failures?
                logger.info(
                    'jira.assignee-not-found',
                    extra={
                        'integration_id': external_issue.integration_id,
                        'user_id': user.id,
                        'issue_key': external_issue.key,
                    }
                )
                return

        try:
            client.assign_issue(external_issue.key, jira_user and jira_user['name'])
        except (ApiUnauthorized, ApiError):
            # TODO(jess): do we want to email people about these types of failures?
            logger.info(
                'jira.failed-to-assign',
                extra={
                    'organization_id': external_issue.organization_id,
                    'integration_id': external_issue.integration_id,
                    'user_id': user.id,
                    'issue_key': external_issue.key,
                }
            )

    def sync_status_outbound(self, external_issue, is_resolved, project_id, **kwargs):
        """
        Propagate a sentry issue's status to a linked issue's status.
        """
        client = self.get_client()
        jira_issue = client.get_issue(external_issue.key)
        jira_project = jira_issue['fields']['project']

        try:
            external_project = IntegrationExternalProject.objects.get(
                external_id=jira_project['id'],
                organization_integration_id__in=OrganizationIntegration.objects.filter(
                    organization_id=external_issue.organization_id,
                    integration_id=external_issue.integration_id,
                )
            )
        except IntegrationExternalProject.DoesNotExist:
            return

        jira_status = external_project.resolved_status if \
            is_resolved else external_project.unresolved_status

        # don't bother updating if it's already the status we'd change it to
        if jira_issue['fields']['status']['id'] == jira_status:
            return

        transitions = client.get_transitions(external_issue.key)

        try:
            transition = [
                t for t in transitions if t['to']['id'] == jira_status
            ][0]
        except IndexError:
            # TODO(jess): Email for failure
            logger.warning(
                'jira.status-sync-fail',
                extra={
                    'organization_id': external_issue.organization_id,
                    'integration_id': external_issue.integration_id,
                    'issue_key': external_issue.key,
                }
            )
            return

        client.transition_issue(external_issue.key, transition['id'])

    def _get_done_statuses(self):
        client = self.get_client()
        statuses = client.get_valid_statuses()
        return {
            s['id'] for s in statuses if s['statusCategory']['key'] == 'done'
        }

    def should_unresolve(self, data):
        done_statuses = self._get_done_statuses()
        c_from = data['changelog']['from']
        c_to = data['changelog']['to']
        return c_from in done_statuses and \
            c_to not in done_statuses

    def should_resolve(self, data):
        done_statuses = self._get_done_statuses()
        c_from = data['changelog']['from']
        c_to = data['changelog']['to']
        return c_to in done_statuses and \
            c_from not in done_statuses

    def create_comment(self, issue_id, user_id, group_note):
        # https://jira.atlassian.com/secure/WikiRendererHelpAction.jspa?section=texteffects
        comment = group_note.data['text']
        quoted_comment = self.create_comment_attribution(user_id, comment)
        return self.get_client().create_comment(issue_id, quoted_comment)

    def create_comment_attribution(self, user_id, comment_text):
        user = User.objects.get(id=user_id)
        attribution = '%s wrote:\n\n' % user.name
        return '%s{quote}%s{quote}' % (attribution, comment_text)

    def update_comment(self, issue_id, user_id, group_note):
        quoted_comment = self.create_comment_attribution(user_id, group_note.data['text'])
        return self.get_client().update_comment(
            issue_id, group_note.data['external_id'], quoted_comment,
        )
