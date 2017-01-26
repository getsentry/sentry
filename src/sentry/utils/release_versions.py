"""
These are for use in data migration to merge duplicate releases
"""

from __future__ import absolute_import

import re


def is_full_sha(version):
    # sha1 or md5
    return bool(re.match(r'[a-f0-9]{40}$', version) or re.match(r'[a-f0-9]{32}$', version))


def is_short_sha(version):
    # short sha
    return bool(re.match(r'[a-f0-9]{7,40}$', version))


def is_semver_like(version):
    return bool(re.match(r'([a-z]*)?(\-)?v?(?:\d+\.)*\d+', version))


def is_travis_build(version):
    # TRAVIS_12345
    return bool(re.match(r'(travis)(\_|\-)([a-f0-9]{1,40}$)', version, re.IGNORECASE))


def is_jenkins_build(version):
    # jenkins-123-abcdeff
    return bool(re.match(r'(jenkins)(\_|\-)([0-9]{1,40})(\_|\-)([a-f0-9]{5,40}$)', version, re.IGNORECASE))


def is_head_tag(version):
    # HEAD-abcdefg, master@abcdeff, master(abcdeff)
    return bool(re.match(r'(head|master|qa)(\_|\-|\@|\()([a-f0-9]{6,40})(\)?)$', version, re.IGNORECASE))


def is_short_sha_and_date(version):
    # abcdefg-2016-03-16
    return bool(re.match(r'([a-f0-9]{7,40})-(\d{4})-(\d{2})-(\d{2})', version))


def is_word_and_date(version):
    # release-2016-01-01
    return bool(re.match(r'([a-z]*)-(\d{4})-(\d{2})-(\d{2})', version))
