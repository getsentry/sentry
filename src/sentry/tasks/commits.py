from __future__ import absolute_import

import logging
import six

from sentry.exceptions import InvalidIdentity, PluginError
from sentry.models import Commit, Release, Repository, User
from sentry.plugins import bindings
from sentry.tasks.base import instrumented_task, retry

logger = logging.getLogger(__name__)


@instrumented_task(name='sentry.tasks.commits.fetch_commits', queue='commits',
                   default_retry_delay=60 * 5, max_retries=5)
@retry(exclude=(Release.DoesNotExist, User.DoesNotExist,))
def fetch_commits(release_id, user_id, refs, prev_release_id=None, **kwargs):
    commit_list = []

    release = Release.objects.get(id=release_id)
    user = User.objects.get(id=user_id)

    prev_release = None
    if prev_release_id is not None:
        try:
            prev_release = Release.objects.get(id=prev_release_id)
        except Release.DoesNotExist:
            pass

    for ref in refs:
        try:
            repo = Repository.objects.get(
                organization_id=release.organization_id,
                name=ref['repository'],
            )
        except Repository.DoesNotExist:
            continue

        try:
            commit = Commit.objects.get(
                organization_id=release.organization_id,
                repository_id=repo.id,
                key=ref['commit'],
            )
        except Commit.DoesNotExist:
            continue

        try:
            provider_cls = bindings.get('repository.provider').get(repo.provider)
        except KeyError:
            continue

        # if previous commit isn't provided, try to get from
        # previous release otherwise, give up
        if ref.get('previousCommit'):
            start_sha = ref['previousCommit']
        elif prev_release:
            try:
                start_sha = Commit.objects.filter(
                    organization_id=release.organization_id,
                    releaseheadcommit__release=prev_release,
                    repository_id=repo.id,
                ).values_list('key', flat=True)[0]
            except IndexError:
                continue
        else:
            continue

        end_sha = commit.key
        provider = provider_cls(id=repo.provider)
        try:
            repo_commits = provider.compare_commits(
                repo, start_sha, end_sha, actor=user
            )
        except NotImplementedError:
            pass
        except (PluginError, InvalidIdentity) as e:
            logger.exception(six.text_type(e))
        else:
            commit_list.extend(repo_commits)

    if commit_list:
        release.set_commits(commit_list)
