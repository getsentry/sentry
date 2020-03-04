from __future__ import absolute_import

import logging
import time

from sentry.digests import get_option_key
from sentry.digests.backends.base import InvalidState
from sentry.digests.notifications import (
    build_digest,
    split_key,
    is_targeted_action_key,
    split_key_for_targeted_action,
)
from sentry.models import Project, ProjectOption
from sentry.tasks.base import instrumented_task
from sentry.utils import snuba

logger = logging.getLogger(__name__)


@instrumented_task(name="sentry.tasks.digests.schedule_digests", queue="digests.scheduling")
def schedule_digests():
    from sentry import digests

    deadline = time.time()

    # The maximum (but hopefully not typical) expected delay can be roughly
    # calculated by adding together the schedule interval, the # of shards *
    # schedule timeout (at least until these are able to be processed in
    # parallel), the expected duration of time an item spends waiting in the
    # queue to be processed for delivery and the expected duration of time an
    # item takes to be processed for delivery, so this timeout should be
    # relatively high to avoid requeueing items before they even had a chance
    # to be processed.
    timeout = 300
    digests.maintenance(deadline - timeout)

    for entry in digests.schedule(deadline):
        deliver_digest.delay(entry.key, entry.timestamp)


@instrumented_task(name="sentry.tasks.digests.deliver_digest", queue="digests.delivery")
def deliver_digest(key, schedule_timestamp=None):
    from sentry import digests

    is_targeted_action = is_targeted_action_key(key)

    try:
        if is_targeted_action:
            mail_action, project, target_type, target_identifier = split_key_for_targeted_action(
                key
            )
        else:
            plugin, project = split_key(key)
    except Project.DoesNotExist as error:
        logger.info("Cannot deliver digest %r due to error: %s", key, error)
        digests.delete(key)
        return

    # Currently only the `mail` plugin has a configuration
    conf_key = "mail" if is_targeted_action else plugin.get_conf_key()
    minimum_delay = ProjectOption.objects.get_value(
        project, get_option_key(conf_key, "minimum_delay")
    )

    with snuba.options_override({"consistent": True}):
        try:
            with digests.digest(key, minimum_delay=minimum_delay) as records:
                digest = build_digest(project, records)
        except InvalidState as error:
            logger.info("Skipped digest delivery: %s", error, exc_info=True)
            return

        if not digest:
            return

        if is_targeted_action:
            mail_action.notify_digest(project, digest, target_type, target_identifier)
        else:
            plugin.notify_digest(project, digest)
