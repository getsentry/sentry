from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import Release
from sentry.testutils import TestCase
from sentry.utils.committers import get_previous_releases, score_path_match_length, tokenize_path


def test_score_path_match_length():
    assert score_path_match_length('foo/bar/baz', 'foo/bar/baz') == 3
    assert score_path_match_length('foo/bar/baz', 'bar/baz') == 2
    assert score_path_match_length('foo/bar/baz', 'baz') == 1
    assert score_path_match_length('foo/bar/baz', 'foo') == 0
    assert score_path_match_length('./foo/bar/baz', 'foo/bar/baz') == 3


def test_tokenize_path():
    assert list(tokenize_path('foo/bar')) == ['bar', 'foo']
    assert list(tokenize_path('foo\\bar')) == ['bar', 'foo']
    assert list(tokenize_path('foo.bar')) == ['foo.bar']


class GetPreviousReleasesTestCase(TestCase):
    def test_simple(self):
        current_datetime = timezone.now()

        org = self.create_organization()
        project = self.create_project(organization=org, name='foo')

        release1 = Release.objects.create(
            organization=org,
            version='a' * 40,
            date_released=current_datetime - timedelta(days=2),
        )

        release1.add_project(project)

        release2 = Release.objects.create(
            organization=org,
            version='b' * 40,
            date_released=current_datetime - timedelta(days=1),
        )

        release2.add_project(project)

        # this shouldn't be included
        release3 = Release.objects.create(
            organization=org,
            version='c' * 40,
            date_released=current_datetime,
        )

        release3.add_project(project)

        releases = list(get_previous_releases(project, release2.version))

        assert len(releases) == 2
        assert releases[0] == release2
        assert releases[1] == release1
