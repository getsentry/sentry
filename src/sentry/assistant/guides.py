from __future__ import absolute_import

from django.utils.translation import ugettext_lazy as _


GUIDES = {
    'issue': {
        'id': 1,
        'cue': _('Get a tour of the issue page'),
        'required_targets': ['exception'],
        'steps': [
            {
                'title': _('Stacktrace'),
                'message': _(
                    'See the sequence of function calls that led to the error, and global/local '
                    'variables for each stack frame.'),
                'target': 'exception',
            },
            {
                'title': _('Breadcrumbs'),
                'message': _(
                    'Breadcrumbs are a trail of events that happened prior to the error. They\'re '
                    'similar to traditional logs but can record more rich structured data. '
                    'When Sentry is used with web frameworks, breadcrumbs are automatically '
                    'captured for events like database calls and network requests.'),
                'target': 'breadcrumbs',
            },
            {
                'title': _('Tags'),
                'message': _(
                    'Tags are arbitrary key-value pairs sent with every event. You can filter '
                    'events by tags - for example, searching for all events from a specific '
                    'machine, browser, release etc. The sidebar on the right shows you the '
                    'distribution of tags for all events in this event group.'),
                'target': 'tags',
            },
            {
                'title': _('Resolution'),
                'message': _(
                    'Resolving an issue removes it from the default dashboard view of unresolved '
                    'issues. You can ask Sentry to alert you when a resolved issue re-occurs.'),
                'target': 'resolve',
            },
            {
                'title': _('Issue number'),
                'message': _(
                    'This is a unique identifier for the issue, and can be included in a commit '
                    'message to tell Sentry to resolve the issue when the commit gets deployed. '
                    'See <a href="https://docs.sentry.io/learn/releases/">Releases</a> '
                    'to learn more.'),
                'target': 'issue_number',
            },
            {
                'title': _('Issue Tracking'),
                'message': _(
                    'Create issues within your project management tool. Sentry integrates with '
                    '<a href="https://docs.sentry.io/integrations/">many popular tools</a>.'),
                'target': 'issue_tracking',
            },
            {
                'title': _('Delete & Discard'),
                'message': _(
                    'Deleting & Discarding an issue deletes most of the data associated with the '
                    'issue and discards future events matching the issue before it reaches your '
                    'stream. This is useful to permanently ignore errors you don\'t care about.'),
                'target': 'delete_discard',
            },
        ],
    },
    'releases': {
        'id': 2,
        'cue': _('What are releases?'),
        'required_targets': ['releases'],
        'steps': [
            {
                'title': _('Releases'),
                'message': _('A release is a specific version of your code deployed to an '
                             'environment. When you tell Sentry about your releases, it can '
                             'predict which commits caused an error and who might be a likely '
                             'owner.'),
                'target': 'releases',
            },
            {
                'title': _('Releases'),
                'message': _('Sentry does this by tying together commits in the release, files '
                             'touched by those commits, files observed in the stacktrace, and '
                             'authors of those files. Learn more about releases '
                             '<a href="https://docs.sentry.io/learn/releases/">here</a>.'),
            },
        ]
    },
}
