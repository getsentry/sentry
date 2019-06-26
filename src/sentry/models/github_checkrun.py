from __future__ import absolute_import, print_function

import logging
import six

from django.utils import timezone
from django.db import models
from sentry.db.models import (
    Model,
    BoundedPositiveIntegerField,
    sane_repr,
)
from sentry.utils.http import absolute_uri


class GitHubCheckRun(Model):
    __core__ = True

    organization_id = BoundedPositiveIntegerField(db_index=True)
    build_id = BoundedPositiveIntegerField(db_index=True)
    # we only store the latest check run per commit
    commit_key = models.CharField(max_length=64, unique=True)
    check_run_id = BoundedPositiveIntegerField(unique=True)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_github_checkrun'

    __repr__ = sane_repr('guid', 'check_run_id')

    @property
    def organization(self):
        from sentry.models import Organization
        return Organization.objects.get_from_cache(id=self.organization_id)

    @classmethod
    def push(cls, build):
        from sentry.models import BuildStatus

        try:
            run = cls.objects.get(
                organization_id=build.organization_id,
                commit_key=build.commit_key,
            )
        except cls.DoesNotExist:
            run = None

        if run:
            logging.getLogger('sentry').info('github.check-run.update')
        else:
            logging.getLogger('sentry').info('github.check-run.create')

        repo = 'getsentry/sentry'
        # https://developer.github.com/v3/checks/runs/#create-a-check-run
        payload = {
            'name': 'Sentry',
            'head_sha': build.commit_key,
            'details_url': absolute_uri('/organizations/{}/builds/{}/'.format(
                build.organization.slug,
                build.guid,
            )),
            'external_id': six.text_type(build.id),
            'status': 'in_progress',
            'started_at': build.date_added.isoformat(),
            'conclusion': 'success' if build.status == BuildStatus.APPROVED else 'failure',
            'completed_at': timezone.now().isoformat(),
            'output': {
                'title': 'Issues approved' if build.status == BuildStatus.APPROVED else 'Issues detected',
                'summary': 'There were a total of {} errors automatically identified.'.format(
                    build.total_events,
                ),
            }
        }
        client = cls.get_client(build.organization_id)

        if run:
            resp = client.patch('/repos/{}/check-runs/{}'.format(repo, run.check_run_id), data=payload, headers={
                'Accept': 'application/vnd.github.antiope-preview+json',
            })
        else:
            resp = client.post('/repos/{}/check-runs'.format(repo), data=payload, headers={
                'Accept': 'application/vnd.github.antiope-preview+json',
            })

        if not run:
            cls.objects.get_or_create(
                organization_id=build.organization_id,
                commit_key=build.commit_key,
                check_run_id=resp['id'],
                defaults={
                    'build_id': build.id,
                }
            )

    @classmethod
    def get_client(cls, organization_id):
        from sentry.models import Integration
        from sentry.integrations.github.client import GitHubAppsClient

        integration = Integration.objects.get(
            provider='github',
            name='getsentry',
            organizationintegration__organization=organization_id,
        )
        return GitHubAppsClient(integration=integration)
