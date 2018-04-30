from __future__ import absolute_import

import logging


logger = logging.getLogger(__name__)


class ChangesetError(Exception):
    pass


def execute_changesets(relay, changesets):
    from django.utils.importlib import import_module
    # TODO(hazat): check security not all imports allowed

    for changeset in changesets:
        try:
            relay_changeset = import_module(
                'sentry.relay.changesets.%s' %
                changeset.get('type'))
        except ImportError:
            return

        execute = getattr(relay_changeset, 'execute')
        try:
            execute(relay, changeset.get('project_id'), changeset.get('data'))
        except ChangesetError:
            logger.error('Changeset failed', exc_info=True)
