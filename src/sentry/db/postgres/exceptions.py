from __future__ import absolute_import

import psycopg2
import six
import traceback

from sentry.utils.compat import implements_to_string


class CompositeTraceback(object):
    def __init__(self, tb_list):
        assert isinstance(tb_list, (list, tuple))
        self.__tb_list = tb_list
        self.__iterator = iter(self)

    def __iter__(self):
        for tb in self.__tb_list:
            while tb:
                self.__curframe = tb
                tb = tb.tb_next
                yield tb

    def tb_frame(self):
        return self.__curframe.tb_frame

    def tb_lasti(self):
        return self.__curframe.tb_lasti

    def tb_lineno(self):
        return self.__curframe.tb_lineno

    def tb_next(self):
        six.next(self.__iterator)
        return self


@implements_to_string
class TransactionAborted(psycopg2.DatabaseError):
    def __init__(self, exc_info, cur_exc_info):
        self.exc_info = exc_info
        self.cur_exc_info = cur_exc_info

    def __repr__(self):
        return '\n'.join(traceback.format_exception(self.__class__, self, self.get_traceback()))

    def __str__(self):
        return u'(%s) %s' % (self.cur_exc_info[0].__name__, self.cur_exc_info[1])

    def get_traceback(self):
        return CompositeTraceback([self.exc_info[2], self.cur_exc_info[2]])
