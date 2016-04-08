"""
sentry.runner.commands.top
~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

from time import time, sleep
from collections import defaultdict, deque
from threading import Thread
from simplejson import loads

import click
from sentry.runner.decorators import configuration


@click.command()
@click.option('--bind', default='0.0.0.0:18000', help='Bind address.', metavar='ADDRESS')
@click.option('--broadcast', default='', help='Broadcast address.', metavar='ADDRESS')
@click.option('--force', default=False, is_flag=True, help='Take over an existing running session.')
@configuration
def top(bind, broadcast, force):
    "Realtime monitor for Sentry"
    bind_host, bind_port = bind.split(':', 1)

    bind_port = int(bind_port)

    from sentry import options

    if not broadcast:
        broadcast_ip, broadcast_port = get_ip_address(), None
        if broadcast_ip is None:
            raise click.ClickException('Unable to determine --broadcast IP address. Please specify manually.')
    else:
        try:
            broadcast_ip, broadcast_port = broadcast.split(':', 1)
        except ValueError:
            broadcast_ip, broadcast_port = broadcast, None

    if broadcast_port is None:
        broadcast_port = bind_port

    broadcast_port = int(broadcast_port)

    if not force:
        current = options.get('sentry:top')
        if current:
            raise click.ClickException('Already an existing session [%s:%s]. Pass --force to take over.' % tuple(current))

    try:
        options.set('sentry:top', (broadcast_ip, broadcast_port))
        run(
            (bind_host, bind_port),
            (broadcast_ip, broadcast_port),
        )
    finally:
        # Attempt to delete the sentry:top key, only if it matches what you're
        # broadcasting as. Otherwise, you could terminate someone else's session.
        current = options.get('sentry:top')
        if current is not None and tuple(current) == (broadcast_ip, broadcast_port):
            options.delete('sentry:top')


def get_ip_address():
    "Attempt to determine a private or public IP address"
    import socket

    ip = socket.gethostbyname(socket.gethostname())
    if not ip.startswith('127.'):
        return ip

    import fcntl
    import struct

    for ifname in 'eth0', 'eth1', 'eth2', 'bond0', 'bond1', 'bond2':
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            return socket.inet_ntoa(fcntl.ioctl(
                s.fileno(),
                0x8915,  # SIOCGIFADDR
                struct.pack('256s', ifname[:15])
            )[20:24])
        except Exception:
            continue

    return None


class TimeSeries(object):
    "A container for time series data by key and value pairs"
    __slots__ = ('_keys',)

    def __init__(self):
        self._keys = defaultdict(TimeSeriesKey)

    def incr(self, key, value):
        self._keys[key].incr(value)

    def keys(self):
        return self._keys.keys()

    def top(self, key):
        return self._keys[key].items()

    def __iter__(self):
        for k in self.keys():
            yield k, self.top(k)


class TimeSeriesKey(object):
    "A specific time series key which contains many values"
    __slots__ = ('_values',)

    def __init__(self):
        self._values = defaultdict(TimeSeriesValue)

    def incr(self, value):
        self._values[value].incr()

    def keys(self):
        return self._values

    def items(self):
        for k, v in self._values.items():
            if v.is_dead():
                del self._values[k]
            yield k, (v.avg_short(), v.avg_mid(), v.avg_long())


class TimeSeriesValue(object):
    "A specific time series value which containes 3 points, short, mid, long"
    __slots__ = ('_points',)

    def __init__(self):
        self._points = [
            TimeSeriesPoint(1),
            TimeSeriesPoint(5),
            TimeSeriesPoint(10),
        ]

    def incr(self):
        p = self._points
        p[0].incr()
        p[1].incr()
        p[2].incr()

    def is_dead(self):
        # Bucket is considered dead, if any of the single points
        # are dead since they are N'Sync.
        return self._points[0].is_dead()

    def avg_short(self):
        return self._points[0].avg()

    def avg_mid(self):
        return self._points[1].avg()

    def avg_long(self):
        return self._points[2].avg()


class TimeSeriesPoint(object):
    "A single time series point"
    __slots__ = ('_times', '_buckets', '_size')

    def __init__(self, size=1):
        self._size = size
        # deques should be 1 larger than expected since
        # we need a window. The latest bucket is always being
        # filled up, and the others are used for data.
        self._times = deque([0], size + 1)
        self._buckets = deque([0], size + 1)

    def incr(self):
        ts = int(time())
        # If our most recent bucket doesn't match the current timestamp,
        # we must be moving to a new bucket.
        if ts != self._times[-1]:
            self._times.append(ts)
            self._buckets.append(1)
        else:
            # otherwise, increment the latest bucket
            self._buckets[-1] += 1

    def __iter__(self):
        # yield (ts, value) points for the entire range of this
        # point, skipping the current bucket since it's filling up
        start = int(time()) - 1
        end = start - self._size
        i = -2
        for x in xrange(start, end, -1):
            try:
                b = self._times[i]
            except IndexError:
                pass
            else:
                if b == x:
                    yield b, self._buckets[i]
                    i -= 1
                    continue
            yield x, 0

    def sum(self):
        return sum([v for _, v in self])

    def avg(self):
        return float(self.sum()) / self._size

    def is_dead(self):
        # Check if there has been data within past 5 seconds, if not, it's dead
        oldest = int(time()) - 5
        return self._times[-1] < oldest


def run(bind, broadcast):
    # Create resolvers for each key to map them to friendlier names
    resolvers = {
        'project': ProjectResolver(),
        'organization': OrganizationResolver(),
        'ip': NoopResolver(),
    }
    for resolver in resolvers.itervalues():
        resolver.start()

    server = UDPServer(bind)
    server.start()

    ui = UI(broadcast, resolvers, server)
    try:
        ui.init_screen()
        while True:
            ui.draw()
            sleep(0.5)
    except (KeyboardInterrupt, SystemExit):
        ui.resetscreen()


class UDPServer(Thread):
    def __init__(self, bind):
        self.bind = bind
        self._stats = TimeSeries()
        Thread.__init__(self)
        self.setDaemon(True)

    def run(self):
        # Read in our UDP stream, which should be structured as such:
        # {
        #     'ip': '127.0.0.1',
        #     'project': 5,
        #     'organization': 1,
        # }
        import socket
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.bind(self.bind)
        while True:
            try:
                data, _ = s.recvfrom(2048)
                data = loads(data)
            except Exception:
                continue

            self._stats.incr('total', 'total')
            for stat in 'ip', 'project', 'organization':
                self._stats.incr(stat, data[stat])

    def get_stats(self):
        return dict(list(self._stats))


class NoopResolver(object):
    def start(self):
        return

    def get(self, keys):
        return {key: key for key in keys}


class ThreadedResolver(Thread):
    def __init__(self):
        self.pending = set()
        self.cache = {}
        Thread.__init__(self)
        self.setDaemon(True)

    def get(self, keys):
        # Fetch resolved keys from the thread local cache.
        # If the key doesn't exist, add into a pending queue to be resolved.
        rv = {}
        for k in keys:
            try:
                v = self.cache[k]
            except KeyError:
                self.pending.add(k)
                v = k
            rv[k] = v
        return rv

    def resolve(self, keys):
        return {key: key for key in keys}

    def run(self):
        # Start the resolution loop.
        while True:
            sleep(1)
            if self.pending:
                self.cache.update(self.resolve(list(self.pending)))
                self.pending = set()


class ProjectResolver(ThreadedResolver):
    def resolve(self, keys):
        from sentry.models import Project

        try:
            projects = {
                p[0]: p[1] + '/' + p[2]
                for p in Project.objects.filter(pk__in=keys).values_list('pk', 'organization__slug', 'slug')
            }
        except Exception:
            projects = {}

        return {
            key: projects.get(key, key)
            for key in keys
        }


class OrganizationResolver(ThreadedResolver):
    def resolve(self, keys):
        from sentry.models import Organization
        try:
            orgs = {
                o[0]: o[1]
                for o in Organization.objects.filter(pk__in=keys).values_list('pk', 'slug')
            }
        except Exception:
            orgs = {}

        return {
            key: orgs.get(key, key)
            for key in keys
        }


def UI(broadcast, resolvers, server):
    # Create UI class inside this function to prevent
    # importing curses at module level. We don't need curses loaded
    # in memory for the rest of the app.
    import curses
    from itertools import count

    class _CursesUI(object):
        def __init__(self, broadcast, resolvers, server):
            self.resolvers = resolvers
            self.server = server
            self.title = 'Sentry [%s:%s]' % broadcast

        def init_screen(self):
            self.win = curses.initscr()
            self.win.nodelay(True)
            self.win.keypad(True)
            curses.start_color()
            curses.init_pair(1, curses.COLOR_WHITE, curses.COLOR_BLACK)
            curses.init_pair(2, curses.COLOR_CYAN, curses.COLOR_BLACK)
            curses.cbreak()

        def draw(self):
            s = self.win
            height, width = s.getmaxyx()
            y = blank_line = count(1).next
            s.erase()

            # Order here is used for display
            STAT_KEYS = 'project', 'organization', 'ip'
            VALUE_WIDTH = 5
            # How much space do we have left after the 3 values columns?
            NAME_WIDTH = width - (VALUE_WIDTH * 3) - 3
            # How many results can we show for each section?
            NUM_RESULTS = (height - 2 - (len(STAT_KEYS) * 2)) / len(STAT_KEYS) - 1

            all_stats = self.server.get_stats()

            # Draw title
            s.addstr(0, 0, self.title, curses.A_DIM | curses.color_pair(2))

            try:
                total = list(all_stats['total'])[0][1]
            except (KeyError, IndexError):
                total = [0, 0, 0]

            s.addstr(y(), 0, ' '.join((
                'Total:',
                str(total[0]).rjust(VALUE_WIDTH + 3),
                str(total[1]).rjust(VALUE_WIDTH + 3),
                str(total[2]).rjust(VALUE_WIDTH + 3),
            )))

            for stat in STAT_KEYS:
                blank_line()
                # Draw heading
                s.addstr(y(), 0, ' '.join((
                    stat.upper().ljust(NAME_WIDTH),
                    '1s'.rjust(VALUE_WIDTH),
                    '5s'.rjust(VALUE_WIDTH),
                    '10s'.rjust(VALUE_WIDTH),
                )), curses.A_DIM | curses.color_pair(2))

                try:
                    stats = all_stats[stat]
                except KeyError:
                    stats = []
                else:
                    # Sort our stats by the "short" timeseries value
                    stats = sorted(stats, key=lambda s: s[1][0], reverse=True)[:NUM_RESULTS]

                if stats:
                    # Map key names to their friendly names from resolver
                    mapping = self.resolvers[stat].get([stat[0] for stat in stats])
                    # Write out the rows
                    for stat, (short, mid, long) in stats:
                        s.addstr(y(), 0, ' '.join((
                            str(mapping[stat]).ljust(NAME_WIDTH)[:NAME_WIDTH],
                            str(int(short)).rjust(VALUE_WIDTH)[:VALUE_WIDTH],
                            str(int(mid)).rjust(VALUE_WIDTH)[:VALUE_WIDTH],
                            str(int(long)).rjust(VALUE_WIDTH)[:VALUE_WIDTH],
                        )))
                else:
                    s.addstr(y(), 0, 'no data', curses.A_DIM | curses.color_pair(1))

            s.refresh()

        def resetscreen(self):
            curses.nocbreak()
            self.win.keypad(False)
            curses.echo()
            curses.endwin()

    return _CursesUI(broadcast, resolvers, server)
