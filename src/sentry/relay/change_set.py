from __future__ import absolute_import

import logging
from importlib import import_module

from sentry.relay.utils import type_to_class_name
from sentry.relay.changesets.base import ChangesetError

logger = logging.getLogger(__name__)


def execute_changesets(relay, changesets):
    for changeset in changesets:
        try:
            relay_changeset = import_module("sentry.relay.changesets.%s" % changeset.get("type"))
        except ImportError:
            logger.error("Changeset failed", exc_info=True)
            return

        change_set_class = getattr(relay_changeset, type_to_class_name(changeset.get("type", None)))
        change_set_inst = change_set_class(relay)

        try:
            change_set_inst.preprocess(changeset)
        except ChangesetError:
            logger.error("Changeset failed", exc_info=True)

        try:
            change_set_inst.execute()
        except ChangesetError:
            logger.error("Changeset failed", exc_info=True)
