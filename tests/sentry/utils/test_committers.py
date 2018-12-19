from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone
from mock import Mock
from uuid import uuid4

from sentry.models import Commit, CommitAuthor, CommitFileChange, Release, Repository
from sentry.testutils import TestCase
from sentry.utils.committers import _get_commit_file_changes, _get_frame_paths, get_previous_releases, score_path_match_length, tokenize_path


class CommitTestCase(TestCase):
    def setUp(self):
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name=self.organization.id,
        )

    def create_commit(self, author=None):
        return Commit.objects.create(
            organization_id=self.organization.id,
            repository_id=self.repo.id,
            key=uuid4().hex,
            author=author,
        )

    def create_commit_with_author(self, user=None, commit=None):
        if not user:
            user = self.create_user(name='Sentry', email='sentry@sentry.io')

        author = CommitAuthor.objects.create(
            organization_id=self.organization.id,
            name=user.name,
            email=user.email,
            external_id=user.id,
        )
        if not commit:
            commit = self.create_commit(author)
        return commit

    def create_commitfilechange(self, commit=None, filename=None, type=None):
        return CommitFileChange.objects.create(
            organization_id=self.organization.id,
            commit=commit or self.create_commit(),
            filename=filename or 'foo.bar',
            type=type or 'M',
        )


class TokenizePathTestCase(TestCase):
    def test_forward_slash(self):
        assert list(tokenize_path('foo/bar')) == ['bar', 'foo']

    def test_back_slash(self):
        assert list(tokenize_path('foo\\bar')) == ['bar', 'foo']

    def test_dot_does_not_separate(self):
        assert list(tokenize_path('foo.bar')) == ['foo.bar']

    def test_additional_slash_in_front(self):
        assert list(tokenize_path('/foo/bar')) == ['bar', 'foo']
        assert list(tokenize_path('\\foo\\bar')) == ['bar', 'foo']

    def test_additional_slash_with_dot_in_front(self):
        # TODO(lb): better name for this?
        # TOOD(lb): Also.... I'm not sure we should be capturing '.'
        assert list(tokenize_path('./')) == ['.']
        assert list(tokenize_path('./../')) == ['..', '.']
        assert list(tokenize_path('./foo/bar')) == ['bar', 'foo', '.']
        assert list(tokenize_path('.\\foo\\bar')) == ['bar', 'foo', '.']

    def test_path_with_spaces(self):
        assert list(tokenize_path('\\foo bar\\bar')) == ['bar', 'foo bar']

    def test_no_path(self):
        assert list(tokenize_path('/')) == []


class ScorePathMatchLengthTest(TestCase):
    def test_equal_paths(self):
        assert score_path_match_length('foo/bar/baz', 'foo/bar/baz') == 3

    def test_partial_match_paths(self):
        assert score_path_match_length('foo/bar/baz', 'bar/baz') == 2
        assert score_path_match_length('foo/bar/baz', 'baz') == 1

    def test_why_is_this_zero(self):
        # TODO(lb): huh?
        assert score_path_match_length('foo/bar/baz', 'foo') == 0

    def test_path_with_empty_path_segment(self):
        assert score_path_match_length('./foo/bar/baz', 'foo/bar/baz') == 3


class GetFramePathsTestCase(TestCase):
    def setUp(self):
        self.event = Mock()
        self.event.data = {}

    def test_data_in_stacktrace_frames(self):
        self.event.data = {'stacktrace': {'frames': ['data']}}
        assert ['data'] == _get_frame_paths(self.event)

    def test_data_in_exception_values(self):
        self.event.data = {'exception': {'values': [{'stacktrace': {'frames': ['data']}}]}}
        assert ['data'] == _get_frame_paths(self.event)

    def test_data_does_not_match(self):
        self.event.data = {'this does not': 'match'}
        assert [] == _get_frame_paths(self.event)

    def test_no_stacktrace_in_exception_values(self):
        self.event.data = {'exception': {'values': [{'this does not': 'match'}]}}
        assert [] == _get_frame_paths(self.event)


class GetCommitFileChangesTestCase(CommitTestCase):
    def setUp(self):
        super(GetCommitFileChangesTestCase, self).setUp()
        file_change_1 = self.create_commitfilechange(filename='hello/app.py', type='A')
        file_change_2 = self.create_commitfilechange(filename='hello/templates/app.html', type='A')
        file_change_3 = self.create_commitfilechange(filename='hello/app.py', type='M')

        # ensuring its not just getting all filechanges
        self.create_commitfilechange(filename='goodbye/app.py', type='A')

        self.file_changes = [file_change_1, file_change_2, file_change_3]
        self.commits = [file_change.commit for file_change in self.file_changes]
        self.path_name_set = {file_change.filename for file_change in self.file_changes}

    def test_no_paths(self):
        assert [] == _get_commit_file_changes(self.commits, {})

    def test_no_valid_paths(self):
        assert [] == _get_commit_file_changes(self.commits, {'/'})

    def test_simple(self):
        assert _get_commit_file_changes(self.commits, self.path_name_set) == self.file_changes


class MatchCommitsPathTestCase(CommitTestCase):
    pass


class GetCommittersTestCase(CommitTestCase):
    def setUp(self):
        super(GetCommittersTestCase, self).setUp()

    def test_get_commits_committer(self):
        pass

    def test_simple(self):
        pass


class GetEventFileCommittersTestCase(TestCase):
    pass


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
