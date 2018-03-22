from __future__ import absolute_import

import json
import responses

from sentry.utils import snuba
from sentry.models import GroupHash
from sentry.testutils import TestCase
from sentry.tagstore.snuba.backend import SnubaTagStorage


class TagStorage(TestCase):
    def setUp(self):
        self.ts = SnubaTagStorage()

        self.proj1 = self.create_project()

        self.proj1env1 = self.create_environment(project=self.proj1, name='dev')
        self.proj1env2 = self.create_environment(project=self.proj1, name='prod')

        self.proj1group1 = self.create_group(self.proj1)
        self.proj1group2 = self.create_group(self.proj1)

        GroupHash.objects.create(project=self.proj1, group=self.proj1group1, hash='1' * 16)
        GroupHash.objects.create(project=self.proj1, group=self.proj1group2, hash='2' * 16)

    @responses.activate
    def test_get_group_ids_for_search_filter(self):
        from sentry.search.base import ANY, EMPTY
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
            'baz': EMPTY,
        }

        with responses.RequestsMock() as rsps:
            def snuba_response_2(request):
                body = json.loads(request.body)
                assert body['project'] == [self.proj1.id]
                assert body['groupby'] == ['issue']
                assert body['issues']
                assert ['tags[foo]', 'IS NOT NULL', None] in body['conditions']
                assert ['tags[baz]', 'IS NULL', None] in body['conditions']
                return (200, {}, json.dumps({
                    'meta': [{'name': 'issue'}, {'name': 'aggregate'}],
                    'data': [{'issue': self.proj1group2.id, 'aggregate': 1}],
                }))

            rsps.add_callback(responses.POST, snuba.SNUBA + '/query', callback=snuba_response_2)
            result = self.ts.get_group_ids_for_search_filter(self.proj1.id, self.proj1env1.id, tags)
            assert result == [self.proj1group2.id]
