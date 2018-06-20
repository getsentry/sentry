from __future__ import absolute_import

from mistune import markdown


from sentry.integrations.issues import IssueSyncMixin

from sentry.integrations.exceptions import ApiUnauthorized, ApiError
from django.utils.translation import ugettext as _


class VstsIssueSync(IssueSyncMixin):
    description = 'Integrate Visual Studio Team Services work items by linking a project.'
    slug = 'vsts'
    conf_key = slug

    issue_fields = frozenset(['id', 'title', 'url'])

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
        vsts_users = client.get_users(self.model.name)
        sentry_email = user.emails.filter(is_verified=True).lower()

        for vsts_user in vsts_users:
            if vsts_user[u'mailAddress'].lower() == sentry_email:
                assignee = vsts_user
                break
        if assignee is None and assign is True:
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
            client.update_work_item(self.instance, external_issue.key, assigned_to=assignee)
        except (ApiUnauthorized, ApiError):
            self.logger.info(
                'vsts.failed-to-assign',
                extra={
                    'integration_id': external_issue.integration_id,
                    'user_id': user.id,
                    'issue_key': external_issue.key,
                }
            )
