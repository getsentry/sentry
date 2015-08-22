import os
import zlib
import json
import click
import urlparse
import logging

from pytz import utc
from datetime import datetime, timedelta
from subprocess import Popen, PIPE
from contextlib import contextmanager
from random import randint

HERE = os.path.abspath(os.path.dirname(__file__))
SENTRY_CONFIG = os.path.join(HERE, 'sentry.conf.py')

# No sentry or django imports before that point
from sentry.utils import runner
runner.configure(config_path=SENTRY_CONFIG, skip_backend_validation=True)
from django.conf import settings

# Fair game from here
from django.core.management import call_command

from sentry.app import tsdb
from sentry.models import User, Team, Project, Release, \
    Organization, OrganizationMember, Activity, ApiKey
from sentry.utils.samples import create_sample_event
from sentry.utils.apidocs import Runner, iter_scenarios, \
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


def create_sample_time_series(event):
    report('ts', 'Creating sample time series for #%s' % event.id)
    group = event.group

    now = datetime.utcnow().replace(tzinfo=utc)

    for _ in xrange(60):
        count = randint(1, 10)
        tsdb.incr_multi((
            (tsdb.models.project, group.project.id),
            (tsdb.models.group, group.id),
        ), now, count)
        tsdb.incr_multi((
            (tsdb.models.organization_total_received,
             group.project.organization_id),
            (tsdb.models.project_total_received, group.project.id),
        ), now, int(count * 1.1))
        tsdb.incr_multi((
            (tsdb.models.organization_total_rejected,
             group.project.organization_id),
            (tsdb.models.project_total_rejected, group.project.id),
        ), now, int(count * 0.1))
        now = now - timedelta(seconds=1)

    for _ in xrange(24 * 30):
        count = randint(100, 1000)
        tsdb.incr_multi((
            (tsdb.models.project, group.project.id),
            (tsdb.models.group, group.id),
        ), now, count)
        tsdb.incr_multi((
            (tsdb.models.organization_total_received,
             group.project.organization_id),
            (tsdb.models.project_total_received, group.project.id),
        ), now, int(count * 1.1))
        tsdb.incr_multi((
            (tsdb.models.organization_total_rejected,
             group.project.organization_id),
            (tsdb.models.project_total_rejected, group.project.id),
        ), now, int(count * 0.1))
        now = now - timedelta(hours=1)


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

    def create_user(self, mail):
        report('data', 'Creating user "%s"' % mail)
        user, _ = User.objects.get_or_create(
            username=mail,
            defaults={
                'email': mail,
            }
        )
        user.set_password('dummy')
        user.save()
        return user

    def create_org(self, name, owner):
        report('data', 'Creating org "%s"' % name)
        org, _ = Organization.objects.get_or_create(
            name=name,
            defaults={
                'owner': owner,
            },
        )

        dummy_member, _ = OrganizationMember.objects.get_or_create(
            user=owner,
            organization=org,
            defaults={
                'has_global_access': False,
            }
        )

        if dummy_member.has_global_access:
            dummy_member.update(has_global_access=False)

        return org

    def create_api_key(self, org, label='Default'):
        report('data', 'Creating API key for "%s"' % org.name)
        return ApiKey.objects.get_or_create(
            organization=org,
            label=label,
            scopes=(1 << len(ApiKey.scopes.keys())) - 1,
        )[0]

    def create_team(self, name, org):
        report('data', 'Creating team "%s"' % name)
        return Team.objects.get_or_create(
            name=name,
            defaults={
                'organization': org,
            },
        )[0]

    def create_project(self, name, team, org):
        report('data', 'Creating project "%s"' % name)
        return Project.objects.get_or_create(
            team=team,
            name=name,
            defaults={
                'organization': org,
            }
        )[0]

    def create_release(self, project, user, version=None):
        if version is None:
            version = os.urandom(20).encode('hex')
        report('data', 'Creating release "%s" for %s' % (version, project))
        release = Release.objects.get_or_create(
            version=version,
            project=project,
        )[0]
        Activity.objects.create(
            type=Activity.RELEASE,
            project=project,
            ident=version,
            user=user,
            data={'version': version},
        )
        return release

    def create_event(self, project, release):
        report('event', 'Creating event for %s' % project.id)
        event = create_sample_event(
            project=project,
            platform='python',
            release=release.version,
        )
        create_sample_time_series(event)
        return event


def dump_json(path, data):
    path = os.path.join(OUTPUT_PATH, path)
    try:
        os.makedirs(os.path.dirname(path))
    except OSError:
        pass
    with open(path, 'w') as f:
        for line in json.dumps(data, indent=2).splitlines():
            f.write(line.rstrip() + '\n')


def run_scenario(vars, scenario_ident, func):
    runner = Runner(vars, scenario_ident)
    report('scenario', 'Running scenario "%s"' % scenario_ident)
    func(runner)
    dump_json('scenarios/%s.json' % scenario_ident, runner.to_json())


@click.command()
def cli():
    """API docs dummy generator."""
    with SentryBox() as box:
        user = box.create_user('john@interstellar.invalid')
        org = box.create_org('The Interstellar Jurisdiction',
                             owner=user)
        api_key = box.create_api_key(org)

        team = box.create_team('Powerful Abolitionist',
                               org=org)

        projects = []
        for project_name in 'Pump Station', 'Prime Mover':
            project = box.create_project(project_name, team=team, org=org)
            release = box.create_release(project=project, user=user)
            event = box.create_event(project=project, release=release)
            projects.append({
                'project': project,
                'release': release,
                'events': [event],
            })

        vars = {
            'org': org,
            'api_key': api_key,
            'me': user,
            'default_project': projects[0]['project'],
            'default_release': projects[0]['release'],
            'default_event': projects[0]['events'][0],
            'teams': [{
                'team': team,
                'projects': projects,
            }],
        }

        for scenario_ident, func in iter_scenarios():
            run_scenario(vars, scenario_ident, func)

        report('docs', 'Exporting endpoint documentation')
        for endpoint in iter_endpoints():
            report('endpoint', 'Exporting docs for "%s"' %
                   endpoint['endpoint_name'])
            dump_json('endpoints/%s.json' % endpoint['endpoint_name'], endpoint)

        report('docs', 'Exporting sections')
        dump_json('sections.json', get_sections())


if __name__ == '__main__':
    cli()
