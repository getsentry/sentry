"""
sentry.tagstore.current.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from sentry.tagstore.base import TagStorage

from .models import EventTag, GroupTagKey, GroupTagValue, TagKey, TagValue


class TagStorage(TagStorage):
    # TODO: this is just here to prove import of these models works
    MODELS = (EventTag, GroupTagKey, GroupTagValue, TagKey, TagValue)
