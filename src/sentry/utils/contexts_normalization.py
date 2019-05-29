from __future__ import absolute_import

from ua_parser.user_agent_parser import Parse
from sentry.utils.safe import get_path, setdefault_path


def _get_version(user_agent):
    return '.'.join(
        value for value in [
            user_agent['major'],
            user_agent['minor'],
            user_agent.get('patch'),
        ] if value
    ) or None


def _parse_user_agent(data):
    try:
        for key, value in get_path(data, 'request', 'headers', filter=True) or ():
            if key != 'User-Agent':
                continue
            if not value:
                continue
            ua = Parse(value)
            if not ua:
                continue
            return ua
    except ValueError:
        pass
    return None


def _inject_browser_context(data, user_agent):
    ua = user_agent['user_agent']
    try:
        if ua['family'] == 'Other':
            return
        setdefault_path(data, 'contexts', 'browser', value={
            'name': ua['family'],
            'version': _get_version(ua),
        })
    except KeyError:
        pass


def _inject_os_context(data, user_agent):
    ua = user_agent['os']
    try:
        if ua['family'] == 'Other':
            return
        setdefault_path(data, 'contexts', 'os', value={
            'name': ua['family'],
            'version': _get_version(ua),
        })
    except KeyError:
        pass


def _inject_device_context(data, user_agent):
    ua = user_agent['device']
    try:
        if ua['family'] == 'Other':
            return
        setdefault_path(data, 'contexts', 'device', value={
            'family': ua['family'],
            'model': ua['model'],
            'brand': ua['brand'],
        })

    except KeyError:
        pass


def normalize_user_agent(data):
    user_agent = _parse_user_agent(data)
    if not user_agent:
        return

    setdefault_path(data, 'contexts', value={})

    _inject_browser_context(data, user_agent)
    _inject_os_context(data, user_agent)
    _inject_device_context(data, user_agent)
