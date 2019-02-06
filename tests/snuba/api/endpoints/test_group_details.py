from __future__ import absolute_import, print_function

import mock

from sentry.models import Environment
from sentry.testutils import APITestCase, SnubaTestCase


class GroupDetailsTest(APITestCase, SnubaTestCase):
    def test_multiple_environments(self):
        group = self.create_group()
        self.login_as(user=self.user)

        environment = Environment.get_or_create(group.project, 'production')
        environment2 = Environment.get_or_create(group.project, 'staging')

        url = u'/api/0/issues/{}/?enable_snuba=1'.format(group.id)

        from sentry.api.endpoints.group_details import tsdb

        with mock.patch(
                'sentry.api.endpoints.group_details.tsdb.get_range',
                side_effect=tsdb.get_range) as get_range:
            response = self.client.get(
                '%s&environment=production&environment=staging' % (url,),
                format='json'
            )
            assert response.status_code == 200
            assert get_range.call_count == 2
            for args, kwargs in get_range.call_args_list:
                assert kwargs['environment_ids'] == [environment.id, environment2.id]

        response = self.client.get('%s&environment=invalid' % (url,), format='json')
        assert response.status_code == 404
