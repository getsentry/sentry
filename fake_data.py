import itertools
import os.path
import random
import time

from sentry.scripts.runner import settings_from_file


def funcs():
    engine = itertools.cycle(['psycopg2', 'mysqldb', 'sqlite3'])
    exceptions = itertools.cycle([SyntaxError, ValueError, TypeError, NameError, IndexError])
    messages = itertools.cycle(['hello world', 'beep boop beep', 'herp derp', 'shiny test data'])
    queries = itertools.cycle(['SELECT * FROM table', 'SELECT COUNT(1) FROM foo', 'INSERT INTO foo (id) VALUES (1)', 'DELETE FROM foo'])
    loggers = itertools.cycle(['root', 'foo', 'foo.bar'])

    def query(client):
        duration = random.randint(0, 10000) / 1000.0
        return client.capture('Query', query=queries.next(), engine=engine.next(), time_spent=duration, site='sql', logger=loggers.next())

    def exception(client):
        try:
            raise exceptions.next()(messages.next())
        except:
            return client.capture('Exception', site='web', logger=loggers.next())

    def message(client):
        return client.capture('Message', message=messages.next(), site='web', logger=loggers.next())

    return [query, exception, message]


def main():
    settings_from_file(os.path.expanduser(os.path.join('~', '.sentry', 'sentry.conf.py')))

    from raven.contrib.django import DjangoClient

    client = DjangoClient()
    functions = funcs()

    while True:
        random.choice(functions)(client)

        time.sleep(1)


if __name__ == '__main__':
    main()