from __future__ import absolute_import


def app_platform_event(action, install, data, actor=None):
    return {
        'action': action,
        'installation': {
            'uuid': install.uuid,
        },
        'data': data,
    }
