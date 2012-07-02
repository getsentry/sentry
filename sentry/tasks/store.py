"""
sentry.tasks.store
~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from datetime import datetime
from simplejson import dumps, loads

from kombu.compat import Publisher, Consumer
from celery.task import task
from celery.messaging import establish_connection

from django.db.models import F
from django.core.serializers.json import DjangoJSONEncoder


@task(ignore_result=True)
def store_event(data, **kwargs):
    """
    Saves an event to the database.
    """
    send_increment_data(data)

def send_increment_data(data):
    connection = establish_connection()
    publisher = Publisher(connection=connection,
                          exchange="data",
                          routing_key="increment_data",
                          exchange_type="direct")

    data = dumps(data, cls=DjangoJSONEncoder)
    publisher.send(data)

    publisher.close()
    connection.close()

def merge_data(data):
    return sorted(data, key=lambda x:datetime.strptime(x['timestamp'], '%Y-%m-%d %H:%M:%S'), reverse=True)[0]

@task
def process_data():
    connection = establish_connection()
    consumer = Consumer(connection=connection,
                        queue="data",
                        exchange="data",
                        routing_key="increment_data",
                        exchange_type="direct")

    data_to_save = {}
    for message in consumer.iterqueue():
        data = message.body
        data = loads(data)
        checksum = data['checksum']
        data_to_save.setdefault(checksum, []).append(data)

    from sentry.models import Group
    for checksum in data_to_save:
        data = data_to_save[checksum]
        merged_times_seen = len(data)
        data = merge_data(data)
        data['timestamp'] = datetime.strptime(data['timestamp'], '%Y-%m-%d %H:%M:%S')
        event = Group.objects.from_kwargs(**data)
        event.group.update(times_seen=F('times_seen') + merged_times_seen - 1)
    
    consumer.close()
    connection.close()
