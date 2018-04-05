from __future__ import absolute_import


from datetime import datetime
import json
import requests
import responses
import time

from sentry.utils import snuba
from sentry.models import GroupHash
from sentry.testutils import TestCase
from sentry.tagstore.snuba.backend import SnubaTagStorage


class TagStorage(TestCase):
    def setUp(self):
        r = requests.post(snuba.SNUBA + '/tests/drop')
        assert r.status_code == 200

        self.ts = SnubaTagStorage()

        self.proj1 = self.create_project()

        self.proj1env1 = self.create_environment(project=self.proj1, name='test')
        self.proj1env2 = self.create_environment(project=self.proj1, name='prod')

        self.proj1group1 = self.create_group(self.proj1)
        self.proj1group2 = self.create_group(self.proj1)

        GroupHash.objects.create(project=self.proj1, group=self.proj1group1, hash='1' * 32)
        GroupHash.objects.create(project=self.proj1, group=self.proj1group2, hash='2' * 32)

        now = datetime.now()
        events = [{
            'event_id': 'x' * 32,
            'primary_hash': '1' * 32,  # proj1group1 hash
            'project_id': self.proj1.id,
            'message': 'message',
            'platform': 'python',
            'datetime': now.strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
            'data': {
                'received': time.mktime(now.timetuple()),
                'tags': {
                    'foo': 'bar',
                    'baz': 'quux',
                    'environment': self.proj1env1.name,
                }
            },
        }] * 2

        r = requests.post(snuba.SNUBA + '/tests/insert', data=json.dumps(events))
        assert r.status_code == 200

    @responses.activate
    def test_get_group_ids_for_search_filter(self):
        from sentry.search.base import ANY
        tags = {
            'foo': 'bar',
            'baz': 'quux',
        }

        with responses.RequestsMock() as rsps:
            def snuba_response(request):
                body = json.loads(request.body)
                assert body['project'] == [self.proj1.id]
                assert body['groupby'] == ['issue']
                assert body['issues']
                assert ['tags[foo]', '=', 'bar'] in body['conditions']
                assert ['tags[baz]', '=', 'quux'] in body['conditions']
                return (200, {}, json.dumps({
                    'meta': [{'name': 'issue'}, {'name': 'aggregate'}],
                    'data': [{'issue': self.proj1group1.id, 'aggregate': 1}],
                }))

            rsps.add_callback(responses.POST, snuba.SNUBA + '/query', callback=snuba_response)
            result = self.ts.get_group_ids_for_search_filter(self.proj1.id, self.proj1env1.id, tags)
            assert result == [self.proj1group1.id]

        tags = {
            'foo': ANY,
        }

        with responses.RequestsMock() as rsps:
            def snuba_response_2(request):
                body = json.loads(request.body)
                assert body['project'] == [self.proj1.id]
                assert body['groupby'] == ['issue']
                assert body['issues']
                assert ['tags[foo]', 'IS NOT NULL', None] in body['conditions']
                return (200, {}, json.dumps({
                    'meta': [{'name': 'issue'}, {'name': 'aggregate'}],
                    'data': [{'issue': self.proj1group2.id, 'aggregate': 1}],
                }))

            rsps.add_callback(responses.POST, snuba.SNUBA + '/query', callback=snuba_response_2)
            result = self.ts.get_group_ids_for_search_filter(self.proj1.id, self.proj1env1.id, tags)
            assert result == [self.proj1group2.id]

    def test_get_group_tag_keys_and_top_values(self):
        result = self.ts.get_group_tag_keys_and_top_values(
            self.proj1.id,
            self.proj1group1.id,
            self.proj1env1.id,
        )
        result.sort(key=lambda r: r['id'])
        assert result[0]['key'] == 'baz'
        assert result[1]['key'] == 'foo'

        assert result[0]['uniqueValues'] == 1
        assert result[0]['totalValues'] == 2

        assert result[0]['topValues'][0]['value'] == 'quux'
        assert result[1]['topValues'][0]['value'] == 'bar'

    def test_get_top_group_tag_values(self):
        resp = self.ts.get_top_group_tag_values(
            self.proj1.id,
            self.proj1group1.id,
            self.proj1env1.id,
            'foo',
            1
        )
        assert len(resp) == 1
        assert resp[0].times_seen == 2
        assert resp[0].key == 'foo'
        assert resp[0].value == 'bar'
        assert resp[0].group_id == self.proj1group1.id
