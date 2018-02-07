from __future__ import absolute_import

GUIDES = {
    'issue': {
        'id': 1,
        'page': 'issue',
        'cue': 'Click here for a tour of the issue page',
        'required_targets': ['exception'],
        'steps': [
            {
                'title': '1. Stacktrace',
                'message': (
                    'See which line in your code caused the error and the entire call '
                    'stack at that point.'),
                'target': 'exception',
            },
            {
                'title': '2. Breadcrumbs',
                'message': (
                    'See the events that happened leading up to the error, which often provides '
                    'insight into what caused the error. This includes things like HTTP requests, '
                    'database calls, and any other custom data you record. Breadcrumbs integrate '
                    'seamlessly with many popular web frameworks and record .'),
                'target': 'breadcrumbs',
            },
            {
                'title': '3. Additional Data',
                'message': (
                    'Send custom data with every error, and attach tags to them that you can '
                    'later search and filter by.'),
                'target': 'extra',
            },
        ],
    },
    # 'settings': {
    #     'id': 2,
    #     'page': 'settings',
    #     'cue': 'Click here for a tour of the Settings page',
    #     'steps': [
    #         {
    #             'title': '1. Alerts',
    #             'message': (
    #                 'Create powerful custom rules that will notify you when errors reach '
    #                 'a certain threshold.'),
    #         },
    #         {
    #             'title': '2. Integrations',
    #             'message': (
    #                 'Integrate seamlessly with your favorite apps so you can stay in the flow.'),
    #         },
    #     ],
    # },
}
