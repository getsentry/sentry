from __future__ import absolute_import

import six
from mistune import markdown


from django.core.urlresolvers import reverse
from sentry.models import IntegrationExternalProject, OrganizationIntegration
from sentry.integrations.issues import IssueSyncMixin

from sentry.integrations.exceptions import ApiUnauthorized, ApiError
from django.utils.translation import ugettext as _


class VstsIssueSync(IssueSyncMixin):
    description = 'Integrate Visual Studio Team Services work items by linking a project.'
    slug = 'vsts'
    conf_key = slug

    issue_fields = frozenset(['id', 'title', 'url'])
    done_categories = frozenset(['Resolved', 'Completed'])

    def get_create_issue_config(self, group, **kwargs):
        fields = super(VstsIssueSync, self).get_create_issue_config(group, **kwargs)
        client = self.get_client()
        try:
            projects = client.get_projects(self.instance)['value']
        except Exception as e:
            self.raise_error(e)

        project_choices = []
        initial_project = ('', '')
        for project in projects:
            project_choices.append((project['id'], project['name']))
            if project['id'] == self.default_project:
                initial_project = project['name']
        return [
            {
                'name': 'project',
                'required': True,
                'name': 'project',
                'type': 'choice',
                'choices': project_choices,
                'defaultValue': initial_project,
                'label': _('Project'),
                'placeholder': initial_project or _('MyProject'),
            }
        ] + fields

    def get_link_issue_config(self, group, **kwargs):
        fields = super(VstsIssueSync, self).get_link_issue_config(group, **kwargs)
        org = group.organization
        autocomplete_url = reverse(
            'sentry-extensions-vsts-search', args=[org.slug, self.model.id],
        )
        for field in fields:
            if field['name'] == 'externalIssue':
                field['url'] = autocomplete_url
                field['type'] = 'select'
        return fields

    def get_issue_url(self, key, **kwargs):
        return 'https://%s/_workitems/edit/%s' % (self.instance, six.text_type(key))

    def create_issue(self, data, **kwargs):
        """
        Creates the issue on the remote service and returns an issue ID.
        """
        project = data.get('project') or self.default_project
        if project is None:
            raise ValueError('VSTS expects project')
        client = self.get_client()

        title = data['title']
        description = data['description']
        # TODO(LB): Why was group removed from method?
        # link = absolute_uri(group.get_absolute_url())
        try:
            created_item = client.create_work_item(
                instance=self.instance,
                project=project,
                title=title,
                # Decriptions cannot easily be seen. So, a comment will be added as well.
                description=markdown(description),
                comment=markdown(description)
                # link=link,
            )
        except Exception as e:
            self.raise_error(e)

        return {
            'key': created_item['id'],
            # 'url': created_item['_links']['html']['href'],
            'title': title,
            'description': description,
        }

    def get_issue(self, issue_id, **kwargs):
        client = self.get_client()
        work_item = client.get_work_item(self.instance, issue_id)
        return {
            'key': work_item['id'],
            'title': work_item['fields']['System.Title'],
            'description': work_item['fields'].get('System.Description')
        }

    def sync_assignee_outbound(self, external_issue, user, assign=True, **kwargs):
        client = self.get_client()
        assignee = None

        # TODO(LB): What's the scope here? is this correct?
        # Get a list of all users in a given scope. How do we define scope?
        # https://docs.microsoft.com/en-us/rest/api/vsts/graph/users/list?view=vsts-rest-4.1

        if assign is True:
            vsts_users = client.get_users(self.model.name)
            sentry_emails = [email.email.lower() for email in user.get_verified_emails()]

            for vsts_user in vsts_users['value']:
                vsts_email = vsts_user.get(u'mailAddress')
                if vsts_email and vsts_email.lower() in sentry_emails:
                    assignee = vsts_user['mailAddress']
                    break

            if assignee is None:
                # TODO(lb): Email people when this happens
                self.logger.info(
                    'vsts.assignee-not-found',
                    extra={
                        'integration_id': external_issue.integration_id,
                        'user_id': user.id,
                        'issue_key': external_issue.key,
                    }
                )
                return

        try:
            client.update_work_item(
                self.instance, external_issue.key, assigned_to=assignee)
        except (ApiUnauthorized, ApiError):
            self.logger.info(
                'vsts.failed-to-assign',
                extra={
                    'integration_id': external_issue.integration_id,
                    'user_id': user.id,
                    'issue_key': external_issue.key,
                }
            )

    def sync_status_outbound(self, external_issue, is_resolved, project_id, **kwargs):
        client = self.get_client()
        work_item = client.get_work_item(self.instance, external_issue.key)

        # For some reason, vsts doesn't include the project id
        # in the work item response.
        # TODO(jess): figure out if there's a better way to do this
        vsts_project_name = work_item['fields']['System.TeamProject']

        vsts_projects = client.get_projects(self.instance)['value']

        vsts_project_id = None
        for p in vsts_projects:
            if p['name'] == vsts_project_name:
                vsts_project_id = p['id']
                break

        try:
            external_project = IntegrationExternalProject.objects.get(
                external_id=vsts_project_id,
                organization_integration_id__in=OrganizationIntegration.objects.filter(
                    organization_id=external_issue.organization_id,
                    integration_id=external_issue.integration_id,
                )
            )
        except IntegrationExternalProject.DoesNotExist:
            self.logger.info(
                'vsts.external-project-not-found',
                extra={
                    'integration_id': external_issue.integration_id,
                    'is_resolved': is_resolved,
                    'issue_key': external_issue.key,
                }
            )
            return

        status = external_project.resolved_status if \
            is_resolved else external_project.unresolved_status

        try:
            client.update_work_item(
                self.instance, external_issue.key, state=status)
        except (ApiUnauthorized, ApiError) as error:
            self.logger.info(
                'vsts.failed-to-change-status',
                extra={
                    'integration_id': external_issue.integration_id,
                    'is_resolved': is_resolved,
                    'issue_key': external_issue.key,
                    'exception': error,
                }
            )

    def should_unresolve(self, data):
        done_states = self.get_done_states(data['project'])
        return data['old_state'] in done_states and not data['new_state'] in done_states

    def should_resolve(self, data):
        done_states = self.get_done_states(data['project'])
        return not data['old_state'] in done_states and data['new_state'] in done_states

    def get_done_states(self, project):
        client = self.get_client()
        all_states = client.get_work_item_states(self.instance, project)['value']
        done_states = [
            state['name'] for state in all_states if state['category'] in self.done_categories
        ]
        return done_states

    def get_issue_display_name(self, external_issue):
        pass
