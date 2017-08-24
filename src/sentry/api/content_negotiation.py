from __future__ import absolute_import

from rest_framework.negotiation import DefaultContentNegotiation
from rest_framework.parsers import FormParser, MultiPartParser


class ConditionalContentNegotiation(DefaultContentNegotiation):
    """
    Overrides the parsers on POST to support file uploads.
    """

    def select_parser(self, request, parsers):
        if request.method == 'POST':
            parsers = [FormParser(), MultiPartParser()]

        return super(ConditionalContentNegotiation, self).select_parser(request, parsers)
