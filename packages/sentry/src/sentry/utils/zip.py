import os
import shutil
import zipfile


def is_unsafe_path(path):
    if os.path.isabs(path):
        return True
    for segment in path.split(os.path.sep):
        if segment == os.path.pardir:
            return True
    return False


def find_common_prefix(members):
    qualifying_members = []
    for member in members:
        pieces = member.split("/")
        if pieces and pieces[0].startswith("."):
            continue
        qualifying_members.append(pieces)

    rv = os.path.commonprefix(qualifying_members)
    if rv:
        return rv[0] + "/"
    return ""


def safe_extract_zip(f, path, strip_toplevel=True):
    """Safely extract a given zip file to a path.  The zipfile can either
    be an open file or a filename.  If the zip is unsafe an exception is
    raised.  Optionally the toplevel folder is stripped off.  If there are
    hidden files on toplevel then, these are silently ignored.
    """
    close = False
    if not isinstance(f, zipfile.ZipFile):
        close = isinstance(f, str)
        zf = zipfile.ZipFile(f, "r")
    else:
        zf = f
    try:
        members = zf.namelist()
        if strip_toplevel:
            prefix = find_common_prefix(members)
        else:
            prefix = ""
        for member in members:
            # Skip directories
            if member.endswith("/"):
                continue

            if not member.startswith(prefix) or is_unsafe_path(member):
                continue
            dst_path = os.path.join(path, member[len(prefix) :])
            try:
                os.makedirs(os.path.dirname(dst_path))
            except OSError:
                pass
            with open(dst_path, "wb") as df:
                with zf.open(member) as sf:
                    shutil.copyfileobj(sf, df)
    finally:
        if close:
            zf.close()
