from __future__ import absolute_import

import re
import six
from itertools import islice

from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.base import strategy


_irrelevant_re = re.compile(r'''(?x)
    (?P<email>
        [a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*
    ) |
    (?P<url>
        \b(wss?|https?|ftp)://[^\s/$.?#].[^\s]*
    ) |
    (?P<uuid>
        \b
            [0-9a-fA-F]{8}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{4}-
            [0-9a-fA-F]{12}
        \b
    ) |
    (?P<sha1>
        \b[0-9a-fA-F]{40}\b
    ) |
    (?P<md5>
        \b[0-9a-fA-F]{32}\b
    ) |
    (?P<date>
        (
            (\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z))|
            (\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))|
            (\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d([+-][0-2]\d:[0-5]\d|Z))
        ) |
        (
            \b(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\s+)?
            (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+
            ([\d]{1,2})\s+
            ([\d]{2}:[\d]{2}:[\d]{2})\s+
            [\d]{4}
        ) |
        (
            \b(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat),\s+)?
            (0[1-9]|[1-2]?[\d]|3[01])\s+
            (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+
            (19[\d]{2}|[2-9][\d]{3})\s+
            (2[0-3]|[0-1][\d]):([0-5][\d])
            (?::(60|[0-5][\d]))?\s+
            ([-\+][\d]{2}[0-5][\d]|(?:UT|GMT|(?:E|C|M|P)(?:ST|DT)|[A-IK-Z]))
        )
    ) |
    (?P<float>
        -?\d+\.\d+
    ) |
    (?P<int>
        -?\d+
    )
''')


def trim_message_for_grouping(string):
    s = '\n'.join(islice((x for x in string.splitlines() if x.strip()), 2)).strip()
    if s != string:
        s += '...'

    def _handle_match(match):
        for key, value in six.iteritems(match.groupdict()):
            if value is not None:
                return '<%s>' % key
        return ''
    return _irrelevant_re.sub(_handle_match, s)


@strategy(
    id='message:v1',
    interfaces=['message'],
    variants=['default'],
    score=0,
)
def message_v1(message_interface, **meta):
    return GroupingComponent(
        id='message',
        values=[message_interface.message or message_interface.formatted],
    )


@strategy(
    id='message:v2',
    interfaces=['message'],
    variants=['default'],
    score=0,
)
def message_v2(message_interface, **meta):
    message_in = message_interface.message or message_interface.formatted
    message_trimmed = trim_message_for_grouping(message_in)
    hint = 'stripped common values' if message_in != message_trimmed else None
    return GroupingComponent(
        id='message',
        values=[message_trimmed],
        hint=hint
    )
