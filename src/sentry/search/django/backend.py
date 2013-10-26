"""
sentry.search.django.backend
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import re
import itertools

from collections import defaultdict

from django.utils.encoding import force_unicode

from sentry.search.base import SearchBackend

# Words which should not be indexed
STOP_WORDS = set(['the', 'of', 'to', 'and', 'a', 'in', 'is', 'it', 'you', 'that'])

# Do not index any words shorter than this
MIN_WORD_LENGTH = 3

# Consider these characters to be punctuation (they will be replaced with spaces prior to word extraction)
PUNCTUATION_CHARS = re.compile('[%s]' % re.escape(".,;:!?@$%^&*()-<>[]{}\\|/`~'\""))


class DjangoSearchBackend(SearchBackend):
    def _tokenize(self, text):
        """
        Given a string, returns a list of tokens.
        """
        if not text:
            return []

        text = PUNCTUATION_CHARS.sub(' ', text)

        words = [
            t[:128].lower() for t in text.split()
            if len(t) >= MIN_WORD_LENGTH and t.lower() not in STOP_WORDS
        ]

        return words

    def index(self, group, event):
        from sentry import app
        from sentry.search.django.models import SearchDocument, SearchToken

        document, created = SearchDocument.objects.get_or_create(
            project=event.project,
            group=group,
            defaults={
                'status': group.status,
                'total_events': 1,
                'date_added': group.first_seen,
                'date_changed': group.last_seen,
            }
        )
        if not created:
            app.buffer.incr(SearchDocument, {
                'total_events': 1,
            }, {
                'id': document.id,
            }, {
                'date_changed': group.last_seen,
                'status': group.status,
            })

            document.total_events += 1
            document.date_changed = group.last_seen
            document.status = group.status

        context = defaultdict(list)
        for interface in event.interfaces.itervalues():
            for k, v in interface.get_search_context(event).iteritems():
                context[k].extend(v)

        context['text'].extend([
            event.message,
            event.logger,
            event.server_name,
            event.culprit,
        ])

        token_counts = defaultdict(lambda: defaultdict(int))
        for field, values in context.iteritems():
            field = field.lower()
            if field == 'text':
                # we only tokenize the base text field
                values = itertools.chain(*[self._tokenize(force_unicode(v)) for v in values])
            else:
                values = [v.lower() for v in values]
            for value in values:
                if not value:
                    continue
                token_counts[field][value] += 1

        for field, tokens in token_counts.iteritems():
            for token, count in tokens.iteritems():
                app.buffer.incr(SearchToken, {
                    'times_seen': count,
                }, {
                    'document': document,
                    'token': token,
                    'field': field,
                })

        return document

    def query(self, project, query, sort_by='score', offset=0, limit=100):
        from sentry.search.django.models import SearchDocument

        tokens = self._tokenize(query)

        if sort_by == 'score':
            order_by = 'SUM(st.times_seen) / sd.total_events DESC'
        elif sort_by == 'new':
            order_by = 'sd.date_added DESC'
        elif sort_by == 'date':
            order_by = 'sd.date_changed DESC'
        else:
            raise ValueError('sort_by: %r' % sort_by)

        if tokens:
            token_sql = ' st.token IN (%s) AND ' % \
                ', '.join('%s' for i in range(len(tokens)))
        else:
            token_sql = ' '

        sql = """
            SELECT sd.*,
                   SUM(st.times_seen) / sd.total_events as score
            FROM sentry_searchdocument as sd
            INNER JOIN sentry_searchtoken as st
                ON st.document_id = sd.id
            WHERE %s
                sd.project_id = %s
            GROUP BY sd.id, sd.group_id, sd.total_events, sd.date_changed, sd.date_added, sd.project_id, sd.status
            ORDER BY %s
            LIMIT %d OFFSET %d
        """ % (
            token_sql,
            project.id,
            order_by,
            limit,
            offset,
        )
        params = tokens

        return list(SearchDocument.objects.raw(sql, params))
