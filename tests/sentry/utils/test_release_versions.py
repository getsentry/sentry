from __future__ import absolute_import

from sentry.utils import release_versions


def test_is_full_sha():
    assert release_versions.is_full_sha('0e55bed8164b977c8f12a75811473cad604453c6')
    assert not release_versions.is_full_sha('0e55bed8164b977c8f12a75811473cad604453gg')
    assert not release_versions.is_full_sha('0e55bed8164b977c8f12a75811473cad604453c')
    assert release_versions.is_full_sha('0e55bed8164b977c8f12a75811473cad')


def test_is_short_sha():
    assert release_versions.is_short_sha('0e55bed8164b977c8f12a75811473cad604453c6')
    assert release_versions.is_short_sha('0e55bed8164b977c8f12a75811473cad604453c')
    assert release_versions.is_short_sha('0e55bed8164b977c8f12a75811473cad')
    assert release_versions.is_short_sha('0e55bed')
    assert not release_versions.is_short_sha('0e55beg')


def test_is_semver_like():
    assert release_versions.is_semver_like('something-1.0.0')
    assert release_versions.is_semver_like('something-v1.0.0')
    assert release_versions.is_semver_like('1.0.0')
    assert release_versions.is_semver_like('v1.0.0')
    assert release_versions.is_semver_like('v-1.0.0')


def test_is_travis_build():
    assert release_versions.is_travis_build('TRAVIS_12345')
    assert release_versions.is_travis_build('TRAVIS-12345')


def test_is_jenkins_build():
    assert release_versions.is_jenkins_build('jenkins-123-abcdeff')
    assert release_versions.is_jenkins_build('jenkins_123_abcdeff')
    assert not release_versions.is_jenkins_build('jenkins_123_abcdefg')


def test_is_head_tag():
    assert release_versions.is_head_tag('HEAD-abcdeff')
    assert release_versions.is_head_tag('master@abcdeff')
    assert release_versions.is_head_tag('master(abcdeff)')
    assert release_versions.is_head_tag('qa-abcdeff')
    assert not release_versions.is_head_tag('master@abcdefg')


def test_is_short_sha_and_date():
    assert release_versions.is_short_sha_and_date('abcdeff-2016-03-16')
    assert not release_versions.is_short_sha_and_date('abcdeff-03-16')


def is_word_and_date():
    assert release_versions.is_word_and_date('release-2016-01-01')
    assert not release_versions.is_word_and_date('release-01-01')
