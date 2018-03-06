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
                    'See the sequence of function calls that led to the error, global and local '
                    'variables for each stack frame.'),
                'target': 'exception',
            },
            {
                'title': _('Breadcrumbs'),
                'message': _(
                    'Breadcrumbs are a trail of events that happened prior to the error. These '
                    'are similar to traditional logs but can record more rich structured data. '
                    'When integrated with web frameworks, breadcrumbs are also automatically '
                    'captured for events like database calls or network requests.'),
                'target': 'breadcrumbs',
            },
            {
                'title': _('Tags'),
                'message': _(
                    'Tags are key-value pairs sent with every event. Here you can see '
                    'the distribution of tags for all events in this event group. Tags are '
                    'useful for searching and filtering events. E.g. you can search for all '
                    'events coming from a specific machine, browser, release etc.'),
                'target': 'tags',
            },
            {
                'title': _('Issue number'),
                'message': _(
                    'The issue number is a unique identifier for the issue, and can be included '
                    'in a commit messages to tell Sentry to resolve the issue when the commit '
                    'gets deployed. See <a href="https://docs.sentry.io/learn/releases/">Releases'
                    '</a> to learn more.'),
                'target': 'issue_number',
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
                             'environment. When you tell Sentry about your releases, it can predict which '
                             'commits caused an error and who might be a likely owner.'),
                'target': 'releases',
            },
            {
                'title': _('Releases'),
                'message': _('Sentry does this by tying together commits in the release, files '
                             'touched by those commits, files observed in the stacktrace, and authors '
                             'of those files. Learn more about releases '
                             '<a href="https://docs.sentry.io/learn/releases/">here</a>.'),
            },
        ]
    },
}
