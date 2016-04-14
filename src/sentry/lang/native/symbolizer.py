try:
    from symsynd.driver import Driver
    from symsynd.report import ReportSymbolizer
    from symsynd.macho.arch import get_cpu_name
    from symsynd.demangle import demangle_symbol
    have_symsynd = True
except ImportError:
    have_symsynd = False

from sentry import options
from sentry.lang.native.dsymcache import dsymcache
from sentry.utils.safe import trim
from sentry.models import DSymSymbol
from sentry.models.dsymfile import MAX_SYM


def trim_frame(frame):
    # This matches what's in stacktrace.py
    frame['symbol_name'] = trim(frame.get('symbol_name'), MAX_SYM)
    frame['filename'] = trim(frame.get('filename'), 256)
    return frame


def find_system_symbol(img, instruction_addr, system_info=None):
    """Finds a system symbol."""
    return DSymSymbol.objects.lookup_symbol(
        instruction_addr=instruction_addr,
        image_addr=img['image_addr'],
        uuid=img['uuid'],
        cpu_name=get_cpu_name(img['cpu_type'],
                              img['cpu_subtype']),
        object_path=img['name'],
        system_info=system_info
    )


def make_symbolizer(project, binary_images, threads=None):
    """Creates a symbolizer for the given project and binary images.  If a
    list of threads is referenced (from an apple crash report) then only
    images needed by those frames are loaded.
    """
    if not have_symsynd:
        raise RuntimeError('symsynd is unavailable.  Install sentry with '
                           'the dsym feature flag.')
    driver = Driver(options.get('dsym.llvm-symbolizer-path') or None)

    if threads is None:
        to_load = [x['uuid'] for x in binary_images]
    else:
        image_map = {}
        for image in binary_images:
            image_map[image['image_addr']] = image['uuid']
        to_load = set()
        for thread in threads:
            for frame in thread['backtrace']['contents']:
                img_uuid = image_map.get(frame['object_addr'])
                if img_uuid is not None:
                    to_load.add(img_uuid)
        to_load = list(to_load)

    dsym_paths, loaded = dsymcache.fetch_dsyms(project, to_load)
    return ReportSymbolizer(driver, dsym_paths, binary_images)


class Symbolizer(object):

    def __init__(self, project, binary_images, threads=None):
        self.symsynd_symbolizer = make_symbolizer(project, binary_images,
                                                  threads=threads)
        self.images = dict((img['image_addr'], img) for img in binary_images)

    def __enter__(self):
        return self.symsynd_symbolizer.driver.__enter__()

    def __exit__(self, *args):
        return self.symsynd_symbolizer.driver.__exit__(*args)

    def symbolize_frame(self, frame, system_info=None):
        # Step one: try to symbolize with cached dsym files.
        new_frame = self.symsynd_symbolizer.symbolize_frame(frame)
        if new_frame is not None:
            return trim_frame(new_frame)

        # If that does not work, look up system symbols.
        img = self.images.get(frame['object_addr'])
        if img is not None:
            symbol = find_system_symbol(img, frame['instruction_addr'],
                                        system_info)
            if symbol is not None:
                symbol = demangle_symbol(symbol) or symbol
                rv = dict(frame, symbol_name=symbol, filename=None,
                          line=0, column=0, uuid=img['uuid'])
                return trim_frame(rv)

    def symbolize_backtrace(self, backtrace, system_info=None):
        rv = []
        for frame in backtrace:
            new_frame = self.symbolize_frame(frame, system_info)
            rv.append(new_frame or frame)
        return rv
