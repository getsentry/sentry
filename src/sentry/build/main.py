import argparse

from sentry.build import _integration_docs, _js_sdk_registry, _static_assets


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.parse_args()

    print("=> integration docs")
    _integration_docs._sync_docs(_integration_docs._TARGET)
    print("=> js sdk registry")
    _js_sdk_registry._download(_js_sdk_registry._TARGET)
    print("=> static assets")
    _static_assets._build_static_assets()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
