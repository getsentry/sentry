"""
Tests for in_app classification in the JS profiling pipeline.
"""

from typing import Any

from sentry.profiles.task import _process_symbolicator_results_for_sample


def make_js_profile(frames: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "version": "1",
        "platform": "javascript",
        "profile": {
            "frames": frames,
            "samples": [{"stack_id": 0, "elapsed_since_start_ns": 1, "thread_id": "1"}],
            "stacks": [list(range(len(frames)))],
            "thread_metadata": {},
        },
    }


def run_profiling_pipeline(raw_frames, symbolicated_frames):
    """Run _process_symbolicator_results_for_sample and return resulting frames."""
    profile = make_js_profile(raw_frames)
    frames_sent = set(range(len(raw_frames)))
    stacktraces = [{"frames": symbolicated_frames}]
    _process_symbolicator_results_for_sample(
        profile, stacktraces, frames_sent, platform="javascript"
    )
    return profile["profile"]["frames"]


class TestProfilingPipelineInAppClassification:
    """
    Tests for the _process_symbolicator_results_for_sample() fix.
    """

    def test_vendor_frame_is_marked_not_in_app(self) -> None:
        """
        Vendor frames should be marked in_app=False by the profiling pipeline
        after symbolication, regardless of whether abs_path resolves to a
        webpack:// URL or stays as a CDN URL.
        """
        raw = [
            {
                "function": "uv",
                "abs_path": "https://business.revolut.com/assets/vendors.b1d183fd6fb0da242e21.js",
                "lineno": 89,
                "colno": 94978,
            }
        ]

        # Scenario A: fully resolved webpack path
        symbolicated_a = [
            {
                "function": "Lj",
                "abs_path": "webpack://revolut-biz-frontend/./node_modules/react-dom/cjs/react-dom.production.min.js",
                "filename": "./node_modules/react-dom/cjs/react-dom.production.min.js",
                "data": {"resolved_with": "release", "symbolicated": True},
                "original_index": 0,
            }
        ]
        assert run_profiling_pipeline(raw, symbolicated_a)[0].get("in_app") is False, (
            "Scenario A: webpack://...node_modules/... frame should be in_app=False"
        )

        # Scenario B: abs_path stays as CDN URL, filename reveals node_modules
        symbolicated_b = [
            {
                "function": "Lj",
                "abs_path": "https://business.revolut.com/assets/vendors.b1d183fd6fb0da242e21.js",
                "filename": "./node_modules/react-dom/cjs/react-dom.production.min.js",
                "data": {"resolved_with": "release", "symbolicated": True},
                "original_index": 0,
            }
        ]
        assert run_profiling_pipeline(raw, symbolicated_b)[0].get("in_app") is False, (
            "Scenario B: CDN URL + node_modules filename should be in_app=False"
        )

    def test_mixed_vendor_and_app_frames(self) -> None:
        """
        End-to-end: a realistic stack with both vendor and app frames.
        """
        raw = [
            {
                "function": "G",
                "abs_path": "https://business.revolut.com/assets/vendors.b1d183fd6fb0da242e21.js",
                "lineno": 168,
                "colno": 115382,
            },
            {
                "function": "render",
                "abs_path": "https://business.revolut.com/assets/main.abc.js",
                "lineno": 1,
                "colno": 100,
            },
            {
                "function": "dispatchAction",
                "abs_path": "https://business.revolut.com/assets/vendors.b1d183fd6fb0da242e21.js",
                "lineno": 89,
                "colno": 200,
            },
            {
                "function": "handleSubmit",
                "abs_path": "https://business.revolut.com/assets/main.abc.js",
                "lineno": 5,
                "colno": 300,
            },
        ]
        symbolicated = [
            {  # vendor — resolves to node_modules
                "function": "Lj",
                "abs_path": "webpack://revolut-biz-frontend/./node_modules/react-dom/cjs/react-dom.production.min.js",
                "filename": "./node_modules/react-dom/cjs/react-dom.production.min.js",
                "data": {"resolved_with": "release", "symbolicated": True},
                "original_index": 0,
            },
            {  # app code
                "function": "PrivatePage",
                "abs_path": "webpack://revolut-biz-frontend/./src/pages/Main/PrivatePage.tsx",
                "filename": "./src/pages/Main/PrivatePage.tsx",
                "in_app": True,
                "data": {"resolved_with": "release", "symbolicated": True},
                "original_index": 1,
            },
            {  # vendor — CDN url + node_modules filename (the Revolut case)
                "function": "dispatchEvent",
                "abs_path": "https://business.revolut.com/assets/vendors.b1d183fd6fb0da242e21.js",
                "filename": "./node_modules/styled-components/dist/styled-components.browser.esm.js",
                "data": {"resolved_with": "release", "symbolicated": True},
                "original_index": 2,
            },
            {  # app code
                "function": "fetchCurrentPricingPlan",
                "abs_path": "webpack://revolut-biz-frontend/./src/domains/PricingPlan/api.ts",
                "filename": "./src/domains/PricingPlan/api.ts",
                "in_app": True,
                "data": {"resolved_with": "release", "symbolicated": True},
                "original_index": 3,
            },
        ]

        frames = run_profiling_pipeline(raw, symbolicated)

        assert len(frames) == 4

        # Vendor frames must be False
        assert frames[0].get("in_app") is False, (
            f"Frame 0 (react-dom) should be in_app=False, got {frames[0].get('in_app')!r}"
        )
        assert frames[2].get("in_app") is False, (
            f"Frame 2 (styled-components) should be in_app=False, got {frames[2].get('in_app')!r}"
        )

        # App frames must be True
        assert frames[1].get("in_app") is True, (
            f"Frame 1 (PrivatePage) should be in_app=True, got {frames[1].get('in_app')!r}"
        )
        assert frames[3].get("in_app") is True, (
            f"Frame 3 (PricingPlan) should be in_app=True, got {frames[3].get('in_app')!r}"
        )
