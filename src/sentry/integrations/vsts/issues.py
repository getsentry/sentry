from __future__ import absolute_import

from mistune import markdown


from sentry.integrations.issues import IssueSyncMixin
from sentry.utils.http import absolute_uri


class VstsIssueSync(IssueSyncMixin):
    description = 'Integrate Visual Studio Team Services work items by linking a project.'
    slug = 'vsts'
    conf_key = slug

    issue_fields = frozenset(['id', 'title', 'url'])

    def get_issue_label(self, group, issue, **kwargs):
        return 'Bug {}'.format(issue['id'])

    def get_issue_url(self, group, issue, **kwargs):
        return issue['url']

    def get_new_issue_fields(self, request, group, event, **kwargs):
        fields = super(VstsIssueSync, self).get_new_issue_fields(
            request, group, event, **kwargs)

        client = self.get_client()

        try:
            projects = client.get_projects(self.instance)
        except Exception as e:
            self.raise_error(e, identity=client.auth)

        return [
            {
                'name': 'project',
                'label': 'Project',
                'default': self.default_project,
                'type': 'text',
                'choices': [i['name'] for i in projects['value']],
                'required': True,
            }
        ] + fields

    def get_link_existing_issue_fields(self, request, group, event, **kwargs):
        return [
            {
                'name': 'item_id',
                'label': 'Work Item ID',
                'default': '',
                'type': 'text',
            },
            {
                'name': 'comment',
                'label': 'Comment',
                'default': 'I\'ve identified this issue in Sentry: {}'.format(
                    absolute_uri(group.get_absolute_url()),
                ),
                'type': 'textarea',
                'help': ('Markdown is supported. Leave blank if you don\'t want to add a comment.'),
                'required': False
            }
        ]

    def create_issue(self, request, group, form_data, **kwargs):
        """
        Creates the issue on the remote service and returns an issue ID.
        """
        project = form_data.get('project') or self.default_project
        client = self.get_client()

        title = form_data['title']
        description = form_data['description']
        link = absolute_uri(group.get_absolute_url())
        try:
            created_item = client.create_work_item(
                instance=self.instance,
                project=project,
                title=title,
                comment=markdown(description),
                link=link,
            )
        except Exception as e:
            self.raise_error(e)

        return {
            'id': created_item['id'],
            'url': created_item['_links']['html']['href'],
            'title': title,
        }

    def link_issue(self, request, group, form_data, **kwargs):
        client = self.get_client()
        if form_data.get('comment'):
            try:
                work_item = client.update_work_item(
                    instance=self.instance,
                    id=form_data['item_id'],
                    link=absolute_uri(group.get_absolute_url()),
                    comment=markdown(form_data['comment']) if form_data.get(
                        'comment') else None,
                )
            except Exception as e:
                self.raise_error(e)
        else:
            try:
                work_item = client.get_work_item(
                    instance=self.instance,
                    id=form_data['item_id'],
                )
            except Exception as e:
                self.raise_error(e)

        return {
            'id': work_item['id'],
            'url': work_item['_links']['html']['href'],
            'title': work_item['fields']['System.Title'],
        }
