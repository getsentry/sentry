from __future__ import absolute_import

from mistune import markdown

from sentry.models import Activity, GroupStatus, ProjectIntegration
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
        return fields

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
        project_integration = ProjectIntegration.objects.get(
            integration_id=external_issue.integration_id,
            project_id=project_id,
        )

        status_name = 'resolve_status' if is_resolved else 'regression_status'
        try:
            status = project_integration.config[status_name]
        except KeyError:
            return
        try:
            self.get_client().update_work_item(
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
        return self.is_done(data['old_category']) and not self.is_done(data['new_category'])

    def should_resolve(self, data):
        return not self.is_done(data['old_category']) and self.is_done(data['new_category'])

    def get_state_categories(self, old_state, new_state, states):
        new_category = None
        old_category = None
        for state in states:
            if state['name'] == new_state:
                new_category = state['category']
            if state['name'] == old_state:
                old_category = state['category']

        return old_category, new_category

    def is_done(self, category):
        return category in self.done_categories

    def sync_status_inbound(self, issue_key, data):
        groups_to_resolve = []
        groups_to_unresolve = []

        new_state = data.get('new_state')
        old_state = data.get('old_state')
        old_category, new_category = self.get_state_categories(
            old_state, new_state, data.get('states'))

        for group in data.get('groups'):
            should_resolve = self.should_resolve(data)
            should_unresolve = self.should_unresolve(data)

            # this probably shouldn't be possible unless there
            # is a bug in one of those methods
            if should_resolve is True and should_unresolve is True:
                self.logger.warning(
                    'sync-config-conflict', extra={
                        'organization_id': group.project.organization_id,
                        'integration_id': self.model.id,
                        'provider': self.model.get_provider(),
                    }
                )
                continue

            if should_unresolve:
                groups_to_unresolve.append(group)
            elif should_resolve:
                groups_to_resolve.append(group)

        if groups_to_resolve:
            self.update_group_status(
                groups_to_resolve,
                GroupStatus.RESOLVED,
                Activity.SET_RESOLVED,
            )

        if groups_to_unresolve:
            self.update_group_status(
                groups_to_unresolve,
                GroupStatus.UNRESOLVED,
                Activity.SET_UNRESOLVED
            )
