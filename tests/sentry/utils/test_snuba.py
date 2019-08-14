from __future__ import absolute_import

from datetime import datetime
import pytz

from sentry.models import GroupRelease, Release
from sentry.testutils import TestCase
from sentry.utils.snuba import get_snuba_translators, zerofill, get_json_type


class SnubaUtilsTest(TestCase):

    def setUp(self):
        self.now = datetime.utcnow().replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
            tzinfo=pytz.UTC
        )
        self.proj1 = self.create_project()
        self.proj1env1 = self.create_environment(project=self.proj1, name='prod')
        self.proj1group1 = self.create_group(self.proj1)
        self.proj1group2 = self.create_group(self.proj1)

        self.release1 = Release.objects.create(
            organization_id=self.organization.id,
            version='1' * 10,
            date_added=self.now,
        )
        self.release1.add_project(self.proj1)
        self.release2 = Release.objects.create(
            organization_id=self.organization.id,
            version='2' * 10,
            date_added=self.now,
        )
        self.release2.add_project(self.proj1)

        self.group1release1 = GroupRelease.objects.create(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            release_id=self.release1.id
        )
        self.group1release2 = GroupRelease.objects.create(
            project_id=self.proj1.id,
            group_id=self.proj1group1.id,
            release_id=self.release2.id
        )
        self.group2release1 = GroupRelease.objects.create(
            project_id=self.proj1.id,
            group_id=self.proj1group2.id,
            release_id=self.release1.id
        )

    def test_translation(self):
        # Case 1: No translation
        filter_keys = {
            'sdk': ['python', 'js']
        }
        forward, reverse = get_snuba_translators(filter_keys)
        assert forward(filter_keys) == filter_keys
        result = [
            {'sdk': 'python', 'count': 123},
            {'sdk': 'js', 'count': 234}
        ]
        assert all(reverse(row) == row for row in result)

        # Case 2: Environment ID -> Name and back
        filter_keys = {
            'environment': [self.proj1env1.id]
        }
        forward, reverse = get_snuba_translators(filter_keys)
        assert forward(filter_keys) == {
            'environment': [self.proj1env1.name]
        }
        row = {
            'environment': self.proj1env1.name,
            'count': 123
        }
        assert reverse(row) == {
            'environment': self.proj1env1.id,
            'count': 123
        }

        # Case 3, both Environment and Release
        filter_keys = {
            'environment': [self.proj1env1.id],
            'tags[sentry:release]': [self.release1.id]
        }
        forward, reverse = get_snuba_translators(filter_keys)
        assert forward(filter_keys) == {
            'environment': [self.proj1env1.name],
            'tags[sentry:release]': [self.release1.version],
        }
        row = {
            'environment': self.proj1env1.name,
            'tags[sentry:release]': self.release1.version,
            'count': 123
        }
        assert reverse(row) == {
            'environment': self.proj1env1.id,
            'tags[sentry:release]': self.release1.id,
            'count': 123
        }

        # Case 4: 2 Groups, many-to-many mapping of Groups
        # to Releases. Reverse translation depends on multiple
        # fields.
        filter_keys = {
            'issue': [
                self.proj1group1.id,
                self.proj1group2.id
            ],
            'tags[sentry:release]': [
                self.group1release1.id,
                self.group1release2.id,
                self.group2release1.id,
            ]
        }
        forward, reverse = get_snuba_translators(filter_keys, is_grouprelease=True)
        assert forward(filter_keys) == {
            'issue': [
                self.proj1group1.id,
                self.proj1group2.id
            ],
            'tags[sentry:release]': [
                self.release1.version,
                self.release2.version,
                self.release1.version,  # Duplicated because 2 GroupReleases refer to it
            ]
        }
        result = [
            {
                'issue': self.proj1group1.id,
                'tags[sentry:release]': self.release1.version,
                'count': 1
            },
            {
                'issue': self.proj1group1.id,
                'tags[sentry:release]': self.release2.version,
                'count': 2
            },
            {
                'issue': self.proj1group2.id,
                'tags[sentry:release]': self.release1.version,
                'count': 3
            },
        ]

        result = [reverse(r) for r in result]
        assert result == [
            {
                'issue': self.proj1group1.id,
                'tags[sentry:release]': self.group1release1.id,
                'count': 1
            },
            {
                'issue': self.proj1group1.id,
                'tags[sentry:release]': self.group1release2.id,
                'count': 2
            },
            {
                'issue': self.proj1group2.id,
                'tags[sentry:release]': self.group2release1.id,
                'count': 3
            },
        ]

    def test_zerofill(self):
        results = zerofill(
            {}, datetime(
                2019, 1, 2, 0, 0), datetime(
                2019, 1, 9, 23, 59, 59), 86400, 'time')
        results_desc = zerofill(
            {}, datetime(
                2019, 1, 2, 0, 0), datetime(
                2019, 1, 9, 23, 59, 59), 86400, '-time')

        assert results == list(reversed(results_desc))

        # Bucket for the 2, 3, 4, 5, 6, 7, 8, 9
        assert len(results) == 8

        assert results[0]['time'] == 1546387200
        assert results[7]['time'] == 1546992000

    def test_get_json_type(self):
        assert get_json_type('UInt8') == 'boolean'
        assert get_json_type('UInt16') == 'integer'
        assert get_json_type('UInt32') == 'integer'
        assert get_json_type('UInt64') == 'integer'
        assert get_json_type('Float32') == 'number'
        assert get_json_type('Float64') == 'number'
        assert get_json_type('Nullable(Float64)') == 'number'
        assert get_json_type('Array(String)') == 'array'
        assert get_json_type('Char') == 'string'
        assert get_json_type('unknown') == 'string'
        assert get_json_type('') == 'string'
