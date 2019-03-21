from __future__ import absolute_import, print_function

import os
import click


def get_docker_client():
    import docker
    client = docker.from_env()
    try:
        client.ping()
        return client
    except Exception:
        raise click.ClickException('Make sure Docker is running.')


def get_or_create(client, thing, name):
    import docker
    try:
        return getattr(client, thing + 's').get(name)
    except docker.errors.NotFound:
        click.secho("> Creating '%s' %s" % (name, thing), err=True, fg='yellow')
        return getattr(client, thing + 's').create(name)


def ensure_interface(ports):
    # If there is no interface specified, make sure the
    # default interface is 127.0.0.1
    rv = {}
    for k, v in ports.items():
        if not isinstance(v, tuple):
            v = ('127.0.0.1', v)
        rv[k] = v
    return rv


class SetType(click.ParamType):
    name = 'set'

    def convert(self, value, param, ctx):
        if value is None:
            return set()
        return set(value.split(','))


Set = SetType()


@click.group()
def devservices():
    """
    Manage dependent development services required for Sentry.

    Do not use in production!
    """


@devservices.command()
@click.option('--project', default='sentry')
@click.option('--exclude', type=Set, help='Services to ignore and not run.')
def up(project, exclude):
    "Run/update dependent services."
    os.environ['SENTRY_SKIP_BACKEND_VALIDATION'] = '1'

    from sentry.runner import configure
    configure()

    from django.conf import settings

    import docker
    client = get_docker_client()

    # This is brittle, but is the best way now to limit what
    # services are run if they're not needed.
    if not exclude:
        exclude = set()

    if 'bigtable' not in settings.SENTRY_NODESTORE:
        exclude |= {'bigtable'}

    if 'memcached' not in settings.CACHES.get('default', {}).get('BACKEND'):
        exclude |= {'memcached'}

    if 'kafka' in settings.SENTRY_EVENTSTREAM:
        pass
    elif 'snuba' in settings.SENTRY_EVENTSTREAM:
        click.secho(
            '! Skipping kafka and zookeeper since your eventstream backend does not require it',
            err=True,
            fg='cyan')
        exclude |= {'kafka', 'zookeeper'}
    else:
        click.secho(
            '! Skipping kafka, zookeeper, snuba, and clickhouse since your eventstream backend does not require it',
            err=True,
            fg='cyan')
        exclude |= {'kafka', 'zookeeper', 'snuba', 'clickhouse'}

    get_or_create(client, 'network', project)

    containers = {}
    for name, options in settings.SENTRY_DEVSERVICES.items():
        if name in exclude:
            continue
        options = options.copy()
        options['network'] = project
        options['detach'] = True
        options['name'] = project + '_' + name
        options.setdefault('ports', {})
        options.setdefault('environment', {})
        options.setdefault('restart_policy', {'Name': 'on-failure'})
        options['ports'] = ensure_interface(options['ports'])
        containers[name] = options

    pulled = set()
    for name, options in containers.items():
        # HACK(mattrobenolt): special handle snuba backend becuase it needs to
        # handle different values based on the eventstream backend
        # For snuba, we can't run the full suite of devserver, but can only
        # run the api.
        if name == 'snuba' and 'snuba' in settings.SENTRY_EVENTSTREAM:
            options['environment'].pop('DEFAULT_BROKERS', None)
            options['command'] = ['devserver', '--no-workers']

        for key, value in options['environment'].items():
            options['environment'][key] = value.format(containers=containers)
        if options.pop('pull', False) and options['image'] not in pulled:
            click.secho("> Pulling image '%s'" % options['image'], err=True, fg='green')
            client.images.pull(options['image'])
            pulled.add(options['image'])
        for mount in options.get('volumes', {}).keys():
            if '/' not in mount:
                get_or_create(client, 'volume', project + '_' + mount)
                options['volumes'][project + '_' + mount] = options['volumes'].pop(mount)
        try:
            container = client.containers.get(options['name'])
        except docker.errors.NotFound:
            pass
        else:
            container.stop()
            container.remove()
        click.secho("> Creating '%s' container" % options['name'], err=True, fg='yellow')
        client.containers.run(**options)


@devservices.command()
@click.option('--project', default='sentry')
@click.argument('service', nargs=-1)
def down(project, service):
    "Shut down all services."
    client = get_docker_client()

    prefix = project + '_'

    for container in client.containers.list(all=True):
        if container.name.startswith(prefix):
            if not service or container.name[len(prefix):] in service:
                click.secho("> Removing '%s' container" % container.name, err=True, fg='red')
                container.stop()
                container.remove()


@devservices.command()
@click.option('--project', default='sentry')
@click.argument('service', nargs=-1)
def rm(project, service):
    "Delete all services and associated data."

    click.confirm(
        'Are you sure you want to continue?\nThis will delete all of your Sentry related data!',
        abort=True)

    import docker
    client = get_docker_client()

    prefix = project + '_'

    for container in client.containers.list(all=True):
        if container.name.startswith(prefix):
            if not service or container.name[len(prefix):] in service:
                click.secho("> Removing '%s' container" % container.name, err=True, fg='red')
                container.stop()
                container.remove()

    for volume in client.volumes.list():
        if volume.name.startswith(prefix):
            if not service or volume.name[len(prefix):] in service:
                click.secho("> Removing '%s' volume" % volume.name, err=True, fg='red')
                volume.remove()

    if not service:
        try:
            network = client.networks.get(project)
        except docker.errors.NotFound:
            pass
        else:
            click.secho("> Removing '%s' network" % network.name, err=True, fg='red')
            network.remove()
