try:
    from symsynd.driver import Driver
    from symsynd.report import ReportSymbolizer
    from symsynd.macho.arch import get_cpu_name
    have_symsynd = True
except ImportError:
    have_symsynd = False

from django.db import connection
from sentry import options
from sentry.lang.native.dsymcache import dsymcache


SDK_MAPPING = {
    'iPhone OS': 'iOS',
}


def get_sdk_from_system_info(info):
    if not info:
        return None
    try:
        sdk_name = SDK_MAPPING[info['system_name']]
        system_version = tuple(int(x) for x in (
            info['system_version'] + '.0' * 3).split('.')[:3])
    except LookupError:
        return None

    return {
        'dsym_type': 'macho',
        'sdk_name': sdk_name,
        'version_major': system_version[0],
        'version_minor': system_version[1],
        'version_patchlevel': system_version[2],
    }


def find_system_symbol(img, instruction_addr, system_info=None):
    """Finds a system symbol."""
    addr = instruction_addr - img['image_addr']

    uuid = img['uuid'].lower()
    cur = connection.cursor()
    try:
        # First try: exact match on uuid
        cur.execute('''
            select symbol
              from sentry_dsymsymbol s,
                   sentry_dsymobject o
             where o.uuid = %s and
                   s.object_id = o.id and
                   s.address <= o.vmaddr + %s and
                   s.address >= o.vmaddr
          order by address desc
             limit 1;
        ''', [uuid, addr])
        rv = cur.fetchone()
        if rv:
            return rv[0]

        # Second try: exact match on path and arch
        cpu_name = get_cpu_name(img['cpu_type'],
                                img['cpu_subtype'])
        sdk_info = get_sdk_from_system_info(system_info)
        if sdk_info is None or cpu_name is None:
            return

        cur.execute('''
            select symbol
              from sentry_dsymsymbol s,
                   sentry_dsymobject o,
                   sentry_dsymsdk k,
                   sentry_dsymbundle b
             where b.sdk_id = k.id and
                   b.object_id = o.id and
                   s.object_id = o.id and
                   k.sdk_name = %s and
                   k.dsym_type = %s and
                   k.version_major = %s and
                   k.version_minor = %s and
                   k.version_patchlevel = %s and
                   o.cpu_name = %s and
                   o.object_path = %s and
                   s.address <= o.vmaddr + %s and
                   s.address >= o.vmaddr
          order by address desc
             limit 1;
        ''', [sdk_info['sdk_name'], sdk_info['dsym_type'],
              sdk_info['version_major'], sdk_info['version_minor'],
              sdk_info['version_patchlevel'], cpu_name, img['name'], addr])
        rv = cur.fetchone()
        if rv:
            return rv[0]
    finally:
        cur.close()


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
            return new_frame

        # If that does not work, look up system symbols.
        img = self.images.get(frame['object_addr'])
        if img is not None:
            symbol = find_system_symbol(img, frame['instruction_addr'],
                                        system_info)
            if symbol is not None:
                return dict(frame, symbol_name=symbol, filename=None,
                            line=0, column=0, uuid=img['uuid'])

    def symbolize_backtrace(self, backtrace, system_info=None):
        rv = []
        for frame in backtrace:
            new_frame = self.symbolize_frame(frame, system_info)
            rv.append(new_frame or frame)
        return rv
