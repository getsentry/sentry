from unittest import TestCase

from sentry.lang.javascript.processing import NODE_MODULES_RE, is_in_app


class JavaScriptProcessingTest(TestCase):
    def test_is_in_app_with_webpack_paths(self):
        # Test webpack paths with node_modules
        self.assertFalse(
            is_in_app(
                {
                    "abs_path": "webpack:///../node_modules/@sentry/browser/esm/helpers.js",
                    "filename": "../node_modules/@sentry/browser/esm/helpers.js",
                }
            )
        )

        # Test webpack paths with ~
        self.assertFalse(
            is_in_app(
                {
                    "abs_path": "webpack:///~/@sentry/browser/esm/helpers.js",
                    "filename": "~/@sentry/browser/esm/helpers.js",
                }
            )
        )

        # Test webpack paths with ./ prefix (should be in-app)
        self.assertTrue(
            is_in_app(
                {
                    "abs_path": "webpack:///./@sentry/browser/esm/helpers.js",
                    "filename": "./@sentry/browser/esm/helpers.js",
                }
            )
        )

        # Test webpack paths with regular path (should be in-app)
        self.assertTrue(
            is_in_app(
                {"abs_path": "webpack:///foo/bar/src/App.jsx", "filename": "foo/bar/src/App.jsx"}
            )
        )

        # Test webpack paths with ./ prefix in abs_path
        self.assertTrue(
            is_in_app(
                {"abs_path": "webpack:///./foo/bar/App.tsx", "filename": "./foo/bar/src/App.jsx"}
            )
        )

        # Test webpack paths with node_modules in ./ path
        self.assertFalse(
            is_in_app(
                {
                    "abs_path": "webpack:///./node_modules/@sentry/browser/esm/helpers.js",
                    "filename": "./node_modules/@sentry/browser/esm/helpers.js",
                }
            )
        )

    def test_is_in_app_with_app_paths(self):
        # Test app paths with node_modules
        self.assertFalse(
            is_in_app(
                {
                    "abs_path": "app:///../node_modules/@sentry/browser/esm/helpers.js",
                    "filename": "../node_modules/@sentry/browser/esm/helpers.js",
                }
            )
        )

        # Test app paths without node_modules
        self.assertTrue(
            is_in_app(
                {
                    "abs_path": "app:///../@sentry/browser/esm/helpers.js",
                    "filename": "../@sentry/browser/esm/helpers.js",
                }
            )
        )

        # Test app paths with node_modules in the path
        self.assertFalse(
            is_in_app(
                {
                    "abs_path": "app:///node_modules/rxjs/internal/operators/switchMap.js",
                    "filename": "node_modules/rxjs/internal/operators/switchMap.js",
                }
            )
        )

    def test_is_in_app_with_general_paths(self):
        # Test file paths with node_modules
        self.assertFalse(
            is_in_app(
                {
                    "abs_path": "file:///../node_modules/@sentry/browser/esm/helpers.js",
                    "filename": "../node_modules/@sentry/browser/esm/helpers.js",
                }
            )
        )

        # Test file paths without node_modules (should return None)
        self.assertIsNone(
            is_in_app(
                {
                    "abs_path": "file:///../@sentry/browser/esm/helpers.js",
                    "filename": "../@sentry/browser/esm/helpers.js",
                }
            )
        )

    def test_node_modules_regex(self):
        # Test the NODE_MODULES_RE pattern directly
        self.assertIsNotNone(NODE_MODULES_RE.search("/node_modules/"))
        self.assertIsNotNone(NODE_MODULES_RE.search("path/node_modules/package"))
        self.assertIsNotNone(NODE_MODULES_RE.search("/path/to/node_modules/react"))

        # Should not match without the slashes
        self.assertIsNone(NODE_MODULES_RE.search("node_modules"))
        self.assertIsNone(NODE_MODULES_RE.search("mynode_modules"))
