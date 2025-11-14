from typing import int
from unittest import TestCase
from unittest.mock import Mock

from sentry.lang.javascript.processing import NODE_MODULES_RE, is_in_app, process_js_stacktraces


class JavaScriptProcessingTest(TestCase):
    def test_is_in_app_with_webpack_paths(self) -> None:
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

    def test_is_in_app_with_app_paths(self) -> None:
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

    def test_is_in_app_with_general_paths(self) -> None:
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

    def test_node_modules_regex(self) -> None:
        # Test the NODE_MODULES_RE pattern directly
        self.assertIsNotNone(NODE_MODULES_RE.search("/node_modules/"))
        self.assertIsNotNone(NODE_MODULES_RE.search("path/node_modules/package"))
        self.assertIsNotNone(NODE_MODULES_RE.search("/path/to/node_modules/react"))

        # Should not match without the slashes
        self.assertIsNone(NODE_MODULES_RE.search("node_modules"))
        self.assertIsNone(NODE_MODULES_RE.search("mynode_modules"))

    def _get_test_data_and_symbolicator(self, in_app_frames: bool, symbolicated_in_app=True):
        """Helper method to create test data and mock symbolicator

        Args:
            in_app_frames: If True, use frames that will be marked as in_app. If False, use only non-in-app frames.
            symbolicated_in_app: Only relevant when in_app_frames=True. If True, all in_app frames will be symbolicated.
                               If False, some in_app frames will not be symbolicated.
        """
        if in_app_frames:
            # Use frames where one is in_app (App.jsx) and one is not (react)
            frames = [
                {
                    "abs_path": "webpack:///app/components/App.jsx",
                    "filename": "app/components/App.jsx",
                    "lineno": 10,
                    "colno": 15,
                    "function": "render",
                    "platform": "javascript",
                },
                {
                    "abs_path": "webpack:///node_modules/react/index.js",
                    "filename": "node_modules/react/index.js",
                    "lineno": 20,
                    "colno": 30,
                    "function": "createElement",
                    "platform": "javascript",
                },
            ]

            symbolicated_frames = [
                {
                    "abs_path": "webpack:///app/components/App.jsx",
                    "filename": "app/components/App.jsx",
                    "lineno": 42,
                    "colno": 23,
                    "function": "MyComponent.renderHeader",
                    "data": {
                        "symbolicated": symbolicated_in_app,
                        "sourcemap": "webpack:///app/components/App.jsx.map",
                        "resolved_with": "source-map",
                    },
                    "platform": "javascript",
                },
                {
                    "abs_path": "webpack:///node_modules/react/index.js",
                    "filename": "./node_modules/react/index.js",  # Note ./ prefix
                    "lineno": 20,
                    "colno": 30,
                    "function": "createElement",
                    "data": {
                        "symbolicated": True,
                        "sourcemap": "webpack:///node_modules/react/index.js.map",
                        "resolved_with": "source-map",
                    },
                    "platform": "javascript",
                },
            ]
        else:
            # Use only non-in-app frames (both from node_modules)
            frames = [
                {
                    "abs_path": "webpack:///node_modules/lodash/index.js",
                    "filename": "./node_modules/lodash/index.js",  # has /node_modules/
                    "lineno": 10,
                    "colno": 15,
                    "function": "map",
                    "platform": "javascript",
                },
                {
                    "abs_path": "webpack:///node_modules/react/index.js",
                    "filename": "./node_modules/react/index.js",  # has /node_modules/
                    "lineno": 20,
                    "colno": 30,
                    "function": "createElement",
                    "platform": "javascript",
                },
            ]

            symbolicated_frames = [
                {
                    "abs_path": "webpack:///node_modules/lodash/index.js",
                    "filename": "./node_modules/lodash/index.js",
                    "lineno": 10,
                    "colno": 15,
                    "function": "map",
                    "platform": "javascript",
                    "data": {"symbolicated": True},
                },
                {
                    "abs_path": "webpack:///node_modules/react/index.js",
                    "filename": "./node_modules/react/index.js",
                    "lineno": 20,
                    "colno": 30,
                    "function": "createElement",
                    "platform": "javascript",
                    "data": {"symbolicated": True},
                },
            ]

        data = {
            "platform": "javascript",
            "exception": {
                "values": [
                    {
                        "type": "Error",
                        "stacktrace": {"frames": frames},
                    }
                ]
            },
        }

        symbolicator = Mock()
        symbolicator.process_js.return_value = {
            "status": "completed",
            "stacktraces": [{"frames": symbolicated_frames}],
            "raw_stacktraces": [{"frames": frames}],
        }
        return data, symbolicator

    def test_process_js_stacktraces_with_symbolicated_in_app_frames(self) -> None:
        """Test symbolicated_in_app is True when all in-app frames are symbolicated"""
        data, symbolicator = self._get_test_data_and_symbolicator(
            in_app_frames=True, symbolicated_in_app=True
        )
        result = process_js_stacktraces(symbolicator, data)
        self.assertTrue(result["symbolicated_in_app"])

    def test_process_js_stacktraces_with_unsymbolicated_in_app_frames(self) -> None:
        """Test symbolicated_in_app is False when in-app frames are not symbolicated"""
        data, symbolicator = self._get_test_data_and_symbolicator(
            in_app_frames=True, symbolicated_in_app=False
        )
        result = process_js_stacktraces(symbolicator, data)
        self.assertFalse(result["symbolicated_in_app"])

    def test_process_js_stacktraces_with_no_in_app_frames(self) -> None:
        """Test symbolicated_in_app is None when all frames are non-in-app"""
        data, symbolicator = self._get_test_data_and_symbolicator(in_app_frames=False)
        result = process_js_stacktraces(symbolicator, data)
        self.assertIsNotNone(result)  # Should process frames and return data
        self.assertIsNone(
            result["symbolicated_in_app"]
        )  # Should be None since no frames are in_app
