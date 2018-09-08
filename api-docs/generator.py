from __future__ import absolute_import

import os
import zlib
import json
import click
import logging
import six

from datetime import datetime
from subprocess import Popen, PIPE
from contextlib import contextmanager
from six.moves.urllib.parse import urlparse

HERE = os.path.abspath(os.path.dirname(__file__))
SENTRY_CONFIG = os.environ['SENTRY_CONF'] = os.path.join(HERE, 'sentry.conf.py')
os.environ['SENTRY_SKIP_BACKEND_VALIDATION'] = '1'

# No sentry or django imports before this point
from sentry.runner import configure
configure()
from django.conf import settings

# Fair game from here
from django.core.management import call_command

from sentry.utils.apidocs import Runner, MockUtils, iter_scenarios, \
    iter_endpoints, get_sections


OUTPUT_PATH = os.path.join(HERE, 'cache')
HOST = urlparse(settings.SENTRY_OPTIONS['system.url-prefix']).netloc


# We don't care about you, go away
_logger = logging.getLogger('sentry.events')
_logger.disabled = True


def color_for_string(s):
    colors = ('red', 'green', 'yellow', 'blue', 'cyan', 'magenta')
    return colors[zlib.crc32(s) % len(colors)]


def report(category, message, fg=None):
    if fg is None:
        fg = color_for_string(category)
    click.echo('[%s] %s: %s' % (
        six.text_type(datetime.utcnow()).split('.')[0],
        click.style(category, fg=fg),
        message
    ))


def launch_redis():
    report('redis', 'Launching redis server')
    cl = Popen(['redis-server', '-'], stdin=PIPE, stdout=open(os.devnull, 'r+'))
    cl.stdin.write('''
    port %(port)s
    databases %(databases)d
    save ""
    ''' % {
        'port': six.text_type(settings.SENTRY_APIDOCS_REDIS_PORT),
        'databases': 4,
    })
    cl.stdin.flush()
    cl.stdin.close()
    return cl


def spawn_sentry():
    report('sentry', 'Launching sentry server')
    cl = Popen(['sentry', '--config=' + SENTRY_CONFIG, 'run', 'web',
                '-w', '1', '--bind', '127.0.0.1:%s' % settings.SENTRY_APIDOCS_WEB_PORT])
    return cl


@contextmanager
def management_connection():
    from sqlite3 import connect
    cfg = settings.DATABASES['default']
    con = connect(cfg['NAME'])
    try:
        con.cursor()
        yield con
    finally:
        con.close()


def init_db():
    drop_db()
    report('db', 'Migrating database (this can take some time)')
    call_command('syncdb', migrate=True, interactive=False,
                 traceback=True, verbosity=0)


def drop_db():
    report('db', 'Dropping database')
    try:
        os.remove(settings.DATABASES['default']['NAME'])
    except (OSError, IOError):
        pass


class SentryBox(object):

    def __init__(self):
        self.redis = None
        self.sentry = None
        self.task_runner = None

    def __enter__(self):
        self.redis = launch_redis()
        self.sentry = spawn_sentry()
        init_db()
        return self

    def __exit__(self, exc_type, exc_value, tb):
        if self.sentry is not None:
            report('sentry', 'Shutting down sentry server')
            self.sentry.kill()
            self.sentry.wait()
        if self.redis is not None:
            report('redis', 'Stopping redis server')
            self.redis.kill()
            self.redis.wait()
        drop_db()


def run_scenario(vars, scenario_ident, func):
    runner = Runner(scenario_ident, func, **vars)
    report('scenario', 'Running scenario "%s"' % scenario_ident)
    func(runner)
    return runner.to_json()


@click.command()
@click.option('--output-path', type=click.Path())
@click.option('--output-format', type=click.Choice(['json', 'markdown', 'both']), default='both')
def cli(output_path, output_format):
    """API docs dummy generator."""
    global OUTPUT_PATH
    if output_path is not None:
        OUTPUT_PATH = os.path.abspath(output_path)
    with SentryBox():
        utils = MockUtils()
        report('org', 'Creating user and organization')
        user = utils.create_user('john@interstellar.invalid')
        org = utils.create_org('The Interstellar Jurisdiction',
                               owner=user)
        api_key = utils.create_api_key(org)

        report('org', 'Creating team')
        team = utils.create_team('Powerful Abolitionist',
                                 org=org)

        projects = []
        for project_name in 'Pump Station', 'Prime Mover':
            report('project', 'Creating project "%s"' % project_name)
            project = utils.create_project(project_name, teams=[team], org=org)
            release = utils.create_release(project=project, user=user)
            report('event', 'Creating event for "%s"' % project_name)

            event1 = utils.create_event(project=project, release=release,
                                        platform='python')
            event2 = utils.create_event(project=project, release=release,
                                        platform='java')
            projects.append({
                'project': project,
                'release': release,
                'events': [event1, event2],
            })

        vars = {
            'org': org,
            'me': user,
            'api_key': api_key,
            'teams': [{
                'team': team,
                'projects': projects,
            }],
        }

        scenario_map = {}
        report('docs', 'Collecting scenarios')
        for scenario_ident, func in iter_scenarios():
            scenario = run_scenario(vars, scenario_ident, func)
            scenario_map[scenario_ident] = scenario

        section_mapping = {}
        report('docs', 'Collecting endpoint documentation')
        for endpoint in iter_endpoints():
            report('endpoint', 'Collecting docs for "%s"' %
                   endpoint['endpoint_name'])

            section_mapping \
                .setdefault(endpoint['section'], []) \
                .append(endpoint)
        sections = get_sections()

        if output_format in ('json', 'both'):
            output_json(sections, scenario_map, section_mapping)
        if output_format in ('markdown', 'both'):
            output_markdown(sections, scenario_map, section_mapping)


def output_json(sections, scenarios, section_mapping):
    report('docs', 'Generating JSON documents')

    for id, scenario in scenarios.items():
        dump_json('scenarios/%s.json' % id, scenario)

    section_listings = {}
    for section, title in sections.items():
        entries = {}
        for endpoint in section_mapping.get(section, []):
            entries[endpoint['endpoint_name']] = endpoint['title']
            dump_json('endpoints/%s.json' % endpoint['endpoint_name'],
                      endpoint)

        section_listings[section] = {
            'title': title,
            'entries': entries
        }
    dump_json('sections.json', {'sections': section_listings})


def output_markdown(sections, scenarios, section_mapping):
    report('docs', 'Generating markdown documents')
    for section, title in sections.items():
        i = 0
        links = []
        for endpoint in section_mapping.get(section, []):
            i += 1
            path = u"{}/{}.md".format(section, endpoint['endpoint_name'])

            endpoint['sidebar_order'] = i
            endpoint['example'] = format_example(endpoint, scenarios)
            endpoint['text'] = "\n".join(endpoint['text'])

            dump_markdown(path, endpoint)

            links.append({'title': endpoint['title'], 'path': path})
        dump_index_markdown(section, title, links)


def dump_json(path, data):
    path = os.path.join(OUTPUT_PATH, 'json', path)
    try:
        os.makedirs(os.path.dirname(path))
    except OSError:
        pass
    with open(path, 'w') as f:
        for line in json.dumps(data, indent=2, sort_keys=True).splitlines():
            f.write(line.rstrip() + '\n')


def dump_index_markdown(section, title, links):
    path = os.path.join(OUTPUT_PATH, 'markdown', section, 'index.md')
    try:
        os.makedirs(os.path.dirname(path))
    except OSError:
        pass
    with open(path, 'w') as f:
        document = """
---
title: {title}
---

{links}
"""
        link_text = '\n'.join([
            u'- [{title}]({{%- link _documentation/api/{path} -%}})'.format(**item)
            for item in links
        ])
        document = document.format(title=title, links=link_text)
        f.write(document)


def dump_markdown(path, data):
    path = os.path.join(OUTPUT_PATH, 'markdown', path)
    try:
        os.makedirs(os.path.dirname(path))
    except OSError:
        pass
    with open(path, 'w') as f:
        document = """
---
title: {title}
sidebar_order: {sidebar_order}
---

{method} {path}

: {text}

## Example

{example}
"""
        document = document.format(**data)
        f.write(document)


def dump_markdown_index(path, data):
    path = os.path.join(OUTPUT_PATH, path)
    try:
        os.makedirs(os.path.dirname(path))
    except OSError:
        pass
    with open(path, 'w') as f:
        document = """
---
title: %(title)s
---

%(links)s
"""
        document = document.format(data)
        f.write(document)


def format_headers(headers):
    if not headers:
        return ''
    headers = [
        u"{}:{}".format(key, value)
        for key, value in headers.items()
    ]
    return '\n'.join(headers)


def format_example(endpoint, scenario_map):
    example = u''
    for scene in endpoint['scenarios']:
        if scene not in scenario_map:
            continue
        scene_data = scenario_map[scene]
        for scenario in scene_data['requests']:
            template_data = {
                'status': scenario['response']['status'],
                'reason': scenario['response']['reason'],
                'method': scenario['request']['method'],
                'path': scenario['request']['path'],
                'request_headers': format_headers(scenario['request']['headers']),
                'request_data': json.dumps(scenario['request']['data'], sort_keys=True, indent=2),
                'response_headers': format_headers(scenario['response']['headers']),
                'response_data': json.dumps(scenario['response']['data'], sort_keys=True, indent=2),
            }
            example += """
```http
{method} {path} HTTP/1.1
Authorization: Bearer {{base64-encoded-key-here}}
{request_headers}
Host: sentry.io

{request_data}
```

```http
HTTP/1.1 {status} {reason}
{response_headers}

{response_data}
```
""".format(**template_data)
    return example


if __name__ == '__main__':
    cli()
