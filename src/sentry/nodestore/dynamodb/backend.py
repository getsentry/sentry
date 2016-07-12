"""
sentry.nodestore.dynamodb.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from time import mktime
from datetime import datetime
from simplejson import JSONEncoder, _default_decoder
from base64 import b64encode, b64decode

from sentry.nodestore.base import NodeStorage
from sentry.utils.iterators import chunked
from .client import DynamodbClient


# Cache an instance of the encoder we want to use
json_dumps = JSONEncoder(
    separators=(',', ':'),
    skipkeys=False,
    ensure_ascii=True,
    check_circular=True,
    allow_nan=True,
    indent=None,
    encoding='utf-8',
    default=None,
).encode

json_loads = _default_decoder.decode


class DynamodbException(Exception):
    def __init__(self, type, message):
        self.type = type
        self.message = message

    def __str__(self):
        return '(%s) %s' % (self.type, self.message)


def serialize(data):
    return b64encode(data.encode('zlib'))


def deserialize(data):
    return b64decode(data).decode('zlib')


def datetime_to_unix(dt):
    return mktime(dt.timetuple())


def utcnow():
    return datetime_to_unix(datetime.utcnow())


class DynamodbNodeStorage(NodeStorage):
    """
    A DynamoDB-based backend for storing node data.

    >>> DynamodbNodeStorage(
    ...     table='SentryNodestore',
    ...     access_key='AWS_ACCESS_KEY',
    ...     secret_key='AWS_SECRET_KEY',
    ...     region='us-east-1',
    ... )
    """
    def __init__(self, table='SentryNodestore',
                 access_key=None, secret_key=None,
                 region='us-east-1', endpoint=None,
                 **connection_options):
        self.table = table
        self.client = DynamodbClient(
            access_key=access_key,
            secret_key=secret_key,
            region=region,
            endpoint=endpoint,
            **connection_options
        )

    def set(self, id, data):
        rv = self.client.urlopen(
            target='DynamoDB_20120810.PutItem',
            body=json_dumps({
                'TableName': self.table,
                'Item': {
                    'Id': {
                        'S': id,
                    },
                    'Created': {
                        'N': str(utcnow()),
                    },
                    'Data': {
                        'B': serialize(data),
                    },
                },
            }),
        )
        if rv.status == 200:
            return
        if rv.status == 400:
            rv = json_loads(rv.data)
            raise DynamodbException(rv['__type'], rv['message'])
        raise DynamodbException('<unknown>', rv.data)

    def delete(self, id):
        rv = self.client.urlopen(
            target='DynamoDB_20120810.DeleteItem',
            body=json_dumps({
                'TableName': self.table,
                'Key': {
                    'Id': {
                        'S': id,
                    },
                },
                'ReturnValues': 'NONE',
            }),
        )
        if rv.status == 200:
            return
        if rv.status == 400:
            rv = json_loads(rv.data)
            raise DynamodbException(rv['__type'], rv['Message'])
        raise DynamodbException('<unknown>', rv.data)

    def get(self, id):
        rv = self.client.urlopen(
            target='DynamoDB_20120810.GetItem',
            body=json_dumps({
                'TableName': self.table,
                'Key': {
                    'Id': {
                        'S': id,
                    },
                },
            })
        )
        if rv.status == 400:
            rv = json_loads(rv.data)
            raise DynamodbException(rv['__type'], rv['message'])

        if rv.status != 200:
            raise DynamodbException('<unknown>', rv.data)

        data = json_loads(rv.data)

        try:
            item = data['Item']
        except KeyError:
            # DynamoDB won't actually return a 404 or anything
            # sensible on a miss, it'll just return an empty
            # dictionary missing 'Item'
            return None

        return deserialize(item['Data']['B'])

    def get_multi(self, id_list):
        # In theory, this entire payload is not allowed to be
        # larger than 16MB for a single response, and we don't
        # handle this case well, but this should be very unlikely
        # since a single key isn't allowed to be more than 400KB
        if len(id_list) == 1:
            id = id_list[0]
            return {id: self.get(id)}

        results = {id: None for id in id_list}

        # Max request size is 100 items
        for chunk in chunked(id_list, 100):
            rv = self.client.urlopen(
                target='DynamoDB_20120810.BatchGetItem',
                body=json_dumps({
                    'RequestItems': {
                        self.table: {
                            'Keys': [
                                {'Id': {'S': id}}
                                for id in chunk
                            ],
                        },
                    },
                })
            )

            if rv.status != 200:
                continue

            data = json_loads(rv.data)

            try:
                items = data['Responses'][self.table]
            except KeyError:
                return None

            for item in items:
                results[item['Id']['S']] = deserialize(item['Data']['B'])

        return results

    def cleanup(self, cutoff_timestamp):
        while True:
            rv = self.client.urlopen(
                target='DynamoDB_20120810.Scan',
                body=json_dumps({
                    'TableName': self.table,
                    'FilterExpression': 'Created < :val',
                    'ExpressionAttributeValues': {
                        ':val': {'N': str(datetime_to_unix(cutoff_timestamp))},
                    }
                })
            )
            if rv.status != 200:
                return

            data = json_loads(rv.data)
            if data['Count'] == 0:
                return

            # TODO(mattrobenolt): parallelize!
            # This is going to be super slow with a large dataset
            for item in data['Items']:
                self.delete(item['Id']['S'])

    def bootstrap(self, write_capacity_units=5, read_capacity_units=5):
        rv = self.client.urlopen(
            target='DynamoDB_20120810.CreateTable',
            body=json_dumps({
                'TableName': self.table,
                'AttributeDefinitions': [
                    {'AttributeName': 'Id', 'AttributeType': 'S'},
                    {'AttributeName': 'Created', 'AttributeType': 'N'},
                ],
                'KeySchema': [
                    {'KeyType': 'HASH', 'AttributeName': 'Id'},
                ],
                'GlobalSecondaryIndexes': [{
                    'IndexName': 'CreatedIndex',
                    'KeySchema': [
                        {'KeyType': 'HASH', 'AttributeName': 'Id'},
                        {'KeyType': 'RANGE', 'AttributeName': 'Created'},
                    ],
                    'Projection': {
                        'ProjectionType': 'KEYS_ONLY',
                    },
                    'ProvisionedThroughput': {
                        'WriteCapacityUnits': write_capacity_units,
                        'ReadCapacityUnits': read_capacity_units,
                    },
                }],
                'ProvisionedThroughput': {
                    'WriteCapacityUnits': write_capacity_units,
                    'ReadCapacityUnits': read_capacity_units,
                },
            })
        )
        if rv.status == 200:
            return
        if rv.status == 400:
            rv = json_loads(rv.data)
            raise DynamodbException(rv['__type'], rv['Message'])
        raise DynamodbException('<unknown>', rv.data)
