from __future__ import absolute_import

import logging

from sentry.exceptions import InvalidIdentity, PluginError
from sentry.models import Deploy, Release, ReleaseHeadCommit, Repository, User
from sentry.plugins import bindings
from sentry.tasks.base import instrumented_task, retry

logger = logging.getLogger(__name__)


@instrumented_task(
    name='sentry.tasks.commits.fetch_commits',
    queue='commits',
    default_retry_delay=60 * 5,
    max_retries=5
)
@retry(exclude=(Release.DoesNotExist, User.DoesNotExist, ))
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
            logger.info(
                'repository.missing',
                extra={
                    'organization_id': release.organization_id,
                    'user_id': user_id,
                    'repository': ref['repository'],
                }
            )
            continue

        try:
            provider_cls = bindings.get('repository.provider').get(repo.provider)
        except KeyError:
            continue

        # if previous commit isn't provided, try to get from
        # previous release otherwise, try to get
        # recent commits from provider api
        start_sha = None
        if ref.get('previousCommit'):
            start_sha = ref['previousCommit']
        elif prev_release:
            try:
                start_sha = ReleaseHeadCommit.objects.filter(
                    organization_id=release.organization_id,
                    release=prev_release,
                    repository_id=repo.id,
                ).values_list(
                    'commit__key', flat=True
                )[0]
            except IndexError:
                pass

        end_sha = ref['commit']
        provider = provider_cls(id=repo.provider)

        try:
            repo_commits = provider.compare_commits(repo, start_sha, end_sha, actor=user)
        except NotImplementedError:
            pass
        except (PluginError, InvalidIdentity):
            logger.exception(
                'fetch_commits.error',
                exc_info=True,
                extra={
                    'organization_id': repo.organization_id,
                    'user_id': user_id,
                    'repository': repo.name,
                    'end_sha': end_sha,
                    'start_sha': start_sha,
                }
            )
        else:
            logger.info(
                'fetch_commits.complete',
                extra={
                    'organization_id': repo.organization_id,
                    'user_id': user_id,
                    'repository': repo.name,
                    'end_sha': end_sha,
                    'start_sha': start_sha,
                    'num_commits': len(repo_commits or []),
                }
            )
            commit_list.extend(repo_commits)

    if commit_list:
        release.set_commits(commit_list)
        deploys = Deploy.objects.filter(
            organization_id=release.organization_id,
            release=release,
            notified=False,
        ).values_list(
            'id', flat=True
        )
        for d_id in deploys:
            Deploy.notify_if_ready(d_id, fetch_complete=True)
