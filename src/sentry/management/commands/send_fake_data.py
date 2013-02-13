
"""
sentry.management.commands.send_fake_data
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import datetime
import itertools
import random
import time

from django.core.management.base import BaseCommand


def funcs():
    exceptions = itertools.cycle([
        SyntaxError('foo must come before bar'),
        ValueError('baz is not a valid choice'),
        TypeError('NoneType cannot be coerced to bar'),
        NotImplementedError('This feature is not implemented'),
        ZeroDivisionError('Your math doesn\'t work'),
        Exception('An unknown exception'),
    ])
    loggers = itertools.cycle(['root', 'foo', 'foo.bar'])
    emails = itertools.cycle(['foo@example.com', 'bar@example.com', 'baz@example.com'])
    timestamps = range(24 * 60 * 60)
    random.shuffle(timestamps)
    timestamps = itertools.cycle(timestamps)

    # def query(client):
    #     duration = random.randint(0, 10000) / 1000.0
    #     return client.capture('Query', query=queries.next(), engine=engine.next(), time_spent=duration, data={'logger': loggers.next(), 'site': 'sql'})

    def exception(client):
        timestamp = datetime.datetime.utcnow() - datetime.timedelta(seconds=timestamps.next())
        try:
            raise exceptions.next()
        except Exception:
            email = emails.next()
            return client.capture('Exception', data={
                'logger': loggers.next(),
                'site': 'web',
                'sentry.interfaces.User': {
                    'id': email,
                    'email': email,
                }
            }, date=timestamp)

    return [exception]


class Command(BaseCommand):
    help = 'Performs any pending database migrations and upgrades'

    def handle(self, **options):
        from raven.contrib.django.models import client

        functions = funcs()

        s = time.time()
        r = 0
        try:
            while True:
                random.choice(functions)(client)
                r += 1
        except KeyboardInterrupt:
            pass
        finally:
            total_time = time.time() - s
            print '%d requests serviced in %.3fs' % (r, total_time)
            avg = total_time / r
            print 'avg of %.3fs/req, %d req/s' % (avg, 1 / avg)
