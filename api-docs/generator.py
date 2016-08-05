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

# No sentry or django imports before that point
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
    report('db', 'Migrating database (this can time some time)')
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
        drop_db()
        if self.redis is not None:
            report('redis', 'Stopping redis server')
            self.redis.kill()
            self.redis.wait()
        if self.sentry is not None:
            report('sentry', 'Shutting down sentry server')
            self.sentry.kill()
            self.sentry.wait()


def dump_json(path, data):
    path = os.path.join(OUTPUT_PATH, path)
    try:
        os.makedirs(os.path.dirname(path))
    except OSError:
        pass
    with open(path, 'w') as f:
        for line in json.dumps(data, indent=2, sort_keys=True).splitlines():
            f.write(line.rstrip() + '\n')


def run_scenario(vars, scenario_ident, func):
    runner = Runner(scenario_ident, func, **vars)
    report('scenario', 'Running scenario "%s"' % scenario_ident)
    func(runner)
    dump_json('scenarios/%s.json' % scenario_ident, runner.to_json())


@click.command()
@click.option('--output-path', type=click.Path())
def cli(output_path):
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
            project = utils.create_project(project_name, team=team, org=org)
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
            'api_key': api_key,
            'me': user,
            'api_key': api_key,
            'teams': [{
                'team': team,
                'projects': projects,
            }],
        }

        for scenario_ident, func in iter_scenarios():
            run_scenario(vars, scenario_ident, func)

        section_mapping = {}

        report('docs', 'Exporting endpoint documentation')
        for endpoint in iter_endpoints():
            report('endpoint', 'Exporting docs for "%s"' %
                   endpoint['endpoint_name'])
            section_mapping.setdefault(endpoint['section'], []) \
                .append((endpoint['endpoint_name'],
                         endpoint['title']))
            dump_json('endpoints/%s.json' % endpoint['endpoint_name'], endpoint)

        report('docs', 'Exporting sections')
        dump_json('sections.json', {
            'sections': dict((section, {
                'title': title,
                'entries': dict(section_mapping.get(section, ())),
            }) for section, title in six.iteritems(get_sections()))
        })


if __name__ == '__main__':
    cli()
