from typing import Any, MutableMapping


def supplement_filename(platform: str, data_frames: MutableMapping[str, Any]):
    # Java stackframes don't have an absolute path in the filename key.
    # That property is usually just the basename of the file. In the future
    # the Java SDK might generate better file paths, but for now we use the module
    # path to approximate the file path so that we can intersect it with commit
    # file paths.
    if platform == "java":
        for frame in data_frames:
            if frame.get("filename") is None:
                continue
            if "/" not in str(frame.get("filename")) and frame.get("module"):
                # Replace the last module segment with the filename, as the
                # terminal element in a module path is the class
                module = frame["module"].split(".")
                module[-1] = frame["filename"]
                frame["filename"] = "/".join(module)
