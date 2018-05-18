from __future__ import absolute_import
from sentry.utils.http import absolute_uri

ISSUE_TYPES = (
    ('bug', 'Bug'), ('enhancement', 'Enhancement'), ('proposal', 'Proposal'), ('task', 'Task'),
)

PRIORITIES = (
    ('trivial', 'Trivial', ), ('minor', 'Minor', ), ('major', 'Major'), ('critical', 'Critical'),
    ('blocker', 'Blocker'),
)

ERR_404 = (
    'Bitbucket returned a 404. Please make sure that '
    'the repo exists, you have access to it, and it has '
    'issue tracking enabled.'
)


class BitbucketFieldsMixin(object):

    # TODO(LB): Just copying and pasting. No idea where these are used.
    def get_configure_plugin_fields(self, request, project, **kwargs):
        return [
            {
                'name': 'repo',
                'label': 'Repository Name',
                'type': 'text',
                'placeholder': 'e.g. getsentry/sentry',
                'help': 'Enter your repository name, including the owner.',
                'required': True,
            }
        ]

    def get_link_existing_issue_fields(self, request, group, event, **kwargs):
        return [
            {
                'name': 'issue_id',
                'label': 'Issue',
                'default': '',
                'type': 'select',
                'has_autocomplete': True
            }, {
                'name': 'comment',
                'label': 'Comment',
                'default': absolute_uri(group.get_absolute_url()),
                'type': 'textarea',
                'help':
                ('Leave blank if you don\'t want to '
                 'add a comment to the Bitbucket issue.'),
                'required': False
            }
        ]

    def get_new_issue_fields(self, request, group, event, **kwargs):
        # fields = super(BitbucketPlugin, self).get_new_issue_fields(request, group, event, **kwargs)
        fields = []
        return [
            {
                'name': 'repo',
                'label': 'Bitbucket Repository',
                'default': self.get_option('repo', group.project),
                'type': 'text',
                'readonly': True
            }
        ] + fields + [
            {
                'name': 'issue_type',
                'label': 'Issue type',
                'default': ISSUE_TYPES[0][0],
                'type': 'select',
                'choices': ISSUE_TYPES
            }, {
                'name': 'priority',
                'label': 'Priority',
                'default': PRIORITIES[0][0],
                'type': 'select',
                'choices': PRIORITIES
            }
        ]

    def get_issue_label(self, group, issue_id, **kwargs):
        return 'Bitbucket-%s' % issue_id

    def get_issue_url(self, group, issue_id, **kwargs):
        repo = self.get_option('repo', group.project)
        return 'https://bitbucket.org/%s/issue/%s/' % (repo, issue_id)
