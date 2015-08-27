import os
import zlib
import json
import click
import urlparse
import logging

from datetime import datetime
from subprocess import Popen, PIPE
from contextlib import contextmanager

HERE = os.path.abspath(os.path.dirname(__file__))
SENTRY_CONFIG = os.path.join(HERE, 'sentry.conf.py')

# No sentry or django imports before that point
from sentry.utils import runner
runner.configure(config_path=SENTRY_CONFIG, skip_backend_validation=True)
from django.conf import settings

# Fair game from here
from django.core.management import call_command

from sentry.utils.apidocs import Runner, MockUtils, iter_scenarios, \
    iter_endpoints, get_sections


OUTPUT_PATH = os.path.join(HERE, 'cache')
HOST = urlparse.urlparse(settings.SENTRY_URL_PREFIX).netloc


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
        str(datetime.utcnow()).split('.')[0],
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
        'port': str(settings.SENTRY_APIDOCS_REDIS_PORT),
        'databases': 4,
    })
    cl.stdin.flush()
    cl.stdin.close()
    return cl


def spawn_sentry():
    report('sentry', 'Launching sentry server')
    cl = Popen(['sentry', '--config=' + SENTRY_CONFIG, 'runserver',
                '-v', '0', '--noreload', '--nothreading',
                '--no-watchers', '--traceback',
                '127.0.0.1:%s' % settings.SENTRY_APIDOCS_WEB_PORT],
               stdout=open('/dev/null', 'r+'))
    return cl


@contextmanager
def management_connection():
    from psycopg2 import connect
    cfg = settings.DATABASES['default']
    con = connect(host=cfg['HOST'],
                  port=cfg['PORT'] or None,
                  password=cfg['PASSWORD'] or None,
                  user=cfg['USER'],
                  database='postgres')
    try:
        con.cursor().execute('COMMIT')
        yield con
    finally:
        con.close()


def init_db():
    report('db', 'Dropping old database')
    cfg = settings.DATABASES['default']
    with management_connection() as con:
        con.cursor().execute('DROP DATABASE IF EXISTS "%s"' % cfg['NAME'])
    report('db', 'Creating new database')
    with management_connection() as con:
        con.cursor().execute('CREATE DATABASE "%s"' % cfg['NAME'])
    report('db', 'Migrating database (this can time some time)')
    call_command('syncdb', migrate=True, interactive=False,
                 traceback=True, verbosity=0)


def drop_db():
    report('db', 'Dropping database')
    cfg = settings.DATABASES['default']
    with management_connection() as con:
        con.cursor().execute('DROP DATABASE "%s"' % cfg['NAME'])


def forcefully_disconnect_clients():
    report('db', 'Disconnecting database connections')
    cfg = settings.DATABASES['default']
    with management_connection() as con:
        con.cursor().execute('''
            SELECT pg_terminate_backend(pg_stat_activity.pid)
            FROM pg_stat_activity
            WHERE pg_stat_activity.datname = %s
              AND pid <> pg_backend_pid();
        ''', (cfg['NAME'],))


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
        forcefully_disconnect_clients()
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
def cli():
    """API docs dummy generator."""
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
            }) for section, title in get_sections().iteritems())
        })


if __name__ == '__main__':
    cli()
