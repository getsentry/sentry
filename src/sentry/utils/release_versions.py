"""
These are for use in data migration to merge duplicate releases
"""

from __future__ import absolute_import

import re

from django.db import IntegrityError, transaction


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


def merge(to_release, from_releases, sentry_models=None):
    # The following models reference release:
    # ReleaseCommit.release
    # ReleaseEnvironment.release_id
    # ReleaseProject.release
    # GroupRelease.release_id
    # GroupResolution.release
    # Group.first_release
    # ReleaseFile.release
    if sentry_models is None:
        from sentry import models
        sentry_models = models

    model_list = (
        sentry_models.ReleaseCommit,
        sentry_models.ReleaseEnvironment,
        sentry_models.ReleaseFile,
        sentry_models.ReleaseProject,
        sentry_models.GroupRelease,
        sentry_models.GroupResolution
    )
    for release in from_releases:
        for model in model_list:
            if hasattr(model, 'release'):
                update_kwargs = {'release': to_release}
            else:
                update_kwargs = {'release_id': to_release.id}
            try:
                with transaction.atomic():
                    model.objects.filter(
                        release_id=release.id
                    ).update(**update_kwargs)
            except IntegrityError:
                for item in model.objects.filter(release_id=release.id):
                    try:
                        with transaction.atomic():
                            model.objects.filter(
                                id=item.id
                            ).update(**update_kwargs)
                    except IntegrityError:
                        item.delete()

        sentry_models.Group.objects.filter(
            first_release=release
        ).update(first_release=to_release)

        release.delete()


def update_version(release, sentry_models):
    old_version = release.version
    project_slug = release.projects.values_list('slug', flat=True)[0]
    new_version = '%s-%s' % (project_slug, old_version)
    sentry_models.Release.objects.filter(
        id=release.id
    ).update(version=new_version)
    sentry_models.TagValue.objects.filter(
        project__in=release.projects.all(),
        key='sentry:release',
        value=old_version
    ).update(value=new_version)
