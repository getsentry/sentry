
"""
sentry.management.commands.send_fake_data
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import eventlet.patcher
import itertools
import random
import time

eventlet.patcher.monkey_patch()

from django.core.management.base import BaseCommand


def funcs():
    engine = itertools.cycle(['psycopg2', 'mysqldb', 'sqlite3'])
    exceptions = itertools.cycle([SyntaxError, ValueError, TypeError, NameError, IndexError])
    messages = itertools.cycle(['hello world', 'beep boop beep', 'herp derp', 'shiny test data'])
    queries = itertools.cycle(['SELECT * FROM table', 'SELECT COUNT(1) FROM foo', 'INSERT INTO foo (id) VALUES (1)', 'DELETE FROM foo'])
    loggers = itertools.cycle(['root', 'foo', 'foo.bar'])

    def query(client):
        duration = random.randint(0, 10000) / 1000.0
        return client.capture('Query', query=queries.next(), engine=engine.next(), time_spent=duration, data={'logger': loggers.next(), 'site': 'sql'})

    def exception(client):
        try:
            raise exceptions.next()(messages.next())
        except:
            return client.capture('Exception', data={'logger': loggers.next(), 'site': 'web'})

    def message(client):
        return client.capture('Message', message=messages.next(), data={'logger': loggers.next(), 'site': 'web'})

    return [query, exception, message]


class Command(BaseCommand):
    help = 'Performs any pending database migrations and upgrades'

    def handle(self, **options):
        from raven.contrib.django.models import get_client

        client = get_client()
        functions = funcs()

        s = time.time()
        r = 0
        try:
            while True:
                random.choice(functions)(client)
                r += 1
                eventlet.sleep(0.3)
        except KeyboardInterrupt:
            pass
        finally:
            total_time = time.time() - s
            print '%d requests serviced in %.3fs' % (r, total_time)
            avg = total_time / r
            print 'avg of %.3fs/req, %d req/s' % (avg, 1 / avg)
