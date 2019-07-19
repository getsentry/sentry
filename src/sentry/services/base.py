from __future__ import absolute_import, print_function


class Service(object):
    name = ''

    def __init__(self, debug=False):
        self.debug = debug
