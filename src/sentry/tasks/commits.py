from __future__ import absolute_import

import logging
import six

from django.core.urlresolvers import reverse

from sentry.exceptions import InvalidIdentity, PluginError
from sentry.models import Deploy, LatestRelease, Release, ReleaseHeadCommit, Repository, User
from sentry.plugins import bindings
from sentry.tasks.base import instrumented_task, retry
from sentry.utils.email import MessageBuilder
from sentry.utils.http import absolute_uri

logger = logging.getLogger(__name__)


def generate_invalid_identity_email(identity, commit_failure=False):
    new_context = {
        'identity': identity,
        'auth_url': absolute_uri(reverse('socialauth_associate', args=[identity.provider])),
        'commit_failure': commit_failure,
    }

    return MessageBuilder(
        subject='Unable to Fetch Commits' if commit_failure else 'Action Required',
        context=new_context,
        template='sentry/emails/identity-invalid.txt',
        html_template='sentry/emails/identity-invalid.html',
    )


def generate_fetch_commits_error_email(release, error_message):
    new_context = {
        'release': release,
        'error_message': error_message,
    }

    return MessageBuilder(
        subject='Unable to Fetch Commits',
        context=new_context,
        template='sentry/emails/unable-to-fetch-commits.txt',
        html_template='sentry/emails/unable-to-fetch-commits.html',
    )


# we're future proofing this function a bit so it could be used with other code

def handle_invalid_identity(identity, commit_failure=False):
    # email the user
    msg = generate_invalid_identity_email(identity, commit_failure)
    msg.send_async(to=[identity.user.email])

    # now remove the identity, as its invalid
    identity.delete()


@instrumented_task(
    name='sentry.tasks.commits.fetch_commits',
    queue='commits',
    default_retry_delay=60 * 5,
    max_retries=5
)
@retry(exclude=(Release.DoesNotExist, User.DoesNotExist, ))
def fetch_commits(release_id, user_id, refs, prev_release_id=None, **kwargs):
    # TODO(dcramer): this function could use some cleanup/refactoring as its a bit unwieldly
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

        binding_key = 'integration-repository.provider' if repo.provider and repo.provider.startswith(
            'integrations:') else 'repository.provider'
        try:
            provider_cls = bindings.get(binding_key).get(repo.provider)
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
        except Exception as exc:
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
            if isinstance(exc, InvalidIdentity) and getattr(exc, 'identity', None):
                handle_invalid_identity(identity=exc.identity, commit_failure=True)
            elif isinstance(exc, (PluginError, InvalidIdentity)):
                msg = generate_fetch_commits_error_email(release, exc.message)
                msg.send_async(to=[user.email])
            else:
                msg = generate_fetch_commits_error_email(
                    release, 'An internal system error occurred.')
                msg.send_async(to=[user.email])
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
            'id', 'environment_id', 'date_finished'
        )

        # XXX(dcramer): i dont know why this would have multiple environments, but for
        # our sanity lets assume it can
        pending_notifications = []
        last_deploy_per_environment = {}
        for deploy_id, environment_id, date_finished in deploys:
            last_deploy_per_environment[environment_id] = (deploy_id, date_finished)
            pending_notifications.append(deploy_id)

        repo_queryset = ReleaseHeadCommit.objects.filter(
            organization_id=release.organization_id,
            release=release,
        ).values_list(
            'repository_id', 'commit',
        )

        # we need to mark LatestRelease, but only if there's not a deploy which has completed
        # *after* this deploy (given we might process commits out of order)
        for repository_id, commit_id in repo_queryset:
            for environment_id, (deploy_id, date_finished) in six.iteritems(
                    last_deploy_per_environment):
                if not Deploy.objects.filter(
                    id__in=LatestRelease.objects.filter(
                        repository_id=repository_id,
                        environment_id=environment_id,
                    ).values('deploy_id'),
                    date_finished__gt=date_finished,
                ).exists():
                    LatestRelease.objects.create_or_update(
                        repository_id=repository_id,
                        environment_id=environment_id,
                        values={
                            'release_id': release.id,
                            'deploy_id': deploy_id,
                            'commit_id': commit_id,
                        }
                    )

        for deploy_id in pending_notifications:
            Deploy.notify_if_ready(deploy_id, fetch_complete=True)
