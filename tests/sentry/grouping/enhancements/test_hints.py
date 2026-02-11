from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import pytest

from sentry.grouping.component import FrameGroupingComponent
from sentry.grouping.enhancer import _combine_hints, _get_hint_for_frame


@dataclass
class DummyRustFrame:
    hint: str | None
    contributes: bool | None = None


in_app_hint = "marked in-app by (...)"
client_in_app_hint = "marked in-app by the client"
out_of_app_hint = "marked out of app by (...)"
client_out_of_app_hint = "marked out of app by the client"
ignored_hint = "ignored by (...)"
ignored_because_hint = "ignored because ..."
unignored_hint = "un-ignored by (...)"
default_system_frame_hint = "non app frame"


@pytest.mark.parametrize(
    [
        "variant_name",
        "final_in_app",
        "client_in_app",
        "rust_hint",
        "incoming_hint",
        "desired_hint_type",
        "expected_result",
    ],
    # This represents every combo of:
    #
    #    variant_name: app or system
    #    final_in_app: True or False
    #    client_in_app: None, True, or False
    #    rust_hint: in_app_hint, out_of_app_hint, ignored_hint, unignored_hint, or None
    #    incoming_hint: None or ignored_because_hint (the only kind of hint that gets set ahead of time)
    #    desired_hint_type: In-app or contributes
    #
    # Some of the combos will never happen in real life, and those that won't are marked. They're still
    # in the list because it's much easier to ensure every case is covered that way.
    #
    # No formatting so that we can keep all the cases as single lines
    # fmt: off
    [
        ("app", True, None, in_app_hint, None, "in-app", in_app_hint),
        ("app", True, None, in_app_hint, None, "contributes", None),
        ("app", True, None, in_app_hint, ignored_because_hint, "in-app", in_app_hint),
        ("app", True, None, in_app_hint, ignored_because_hint, "contributes", ignored_because_hint),
        ("app", True, None, out_of_app_hint, None, "in-app", out_of_app_hint),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("app", True, None, out_of_app_hint, None, "contributes", None),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("app", True, None, out_of_app_hint, ignored_because_hint, "in-app", out_of_app_hint),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("app", True, None, out_of_app_hint, ignored_because_hint, "contributes", ignored_because_hint),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("app", True, None, ignored_hint, None, "in-app", None),
        ("app", True, None, ignored_hint, None, "contributes", ignored_hint),
        ("app", True, None, ignored_hint, ignored_because_hint, "in-app", None),
        ("app", True, None, ignored_hint, ignored_because_hint, "contributes", ignored_hint),
        ("app", True, None, unignored_hint, None, "in-app", None),
        ("app", True, None, unignored_hint, None, "contributes", unignored_hint),
        ("app", True, None, unignored_hint, ignored_because_hint, "in-app", None),
        ("app", True, None, unignored_hint, ignored_because_hint, "contributes", unignored_hint),
        ("app", True, None, None, None, "in-app", None),
        ("app", True, None, None, None, "contributes", None),
        ("app", True, None, None, ignored_because_hint, "in-app", None),
        ("app", True, None, None, ignored_because_hint, "contributes", ignored_because_hint),
        ("app", True, True, in_app_hint, None, "in-app", client_in_app_hint),
        ("app", True, True, in_app_hint, None, "contributes", None),
        ("app", True, True, in_app_hint, ignored_because_hint, "in-app", client_in_app_hint),
        ("app", True, True, in_app_hint, ignored_because_hint, "contributes", ignored_because_hint),
        ("app", True, True, out_of_app_hint, None, "in-app", client_in_app_hint),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("app", True, True, out_of_app_hint, None, "contributes", None),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("app", True, True, out_of_app_hint, ignored_because_hint, "in-app", client_in_app_hint),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("app", True, True, out_of_app_hint, ignored_because_hint, "contributes", ignored_because_hint),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("app", True, True, ignored_hint, None, "in-app", client_in_app_hint),
        ("app", True, True, ignored_hint, None, "contributes", ignored_hint),
        ("app", True, True, ignored_hint, ignored_because_hint, "in-app", client_in_app_hint),
        ("app", True, True, ignored_hint, ignored_because_hint, "contributes", ignored_hint),
        ("app", True, True, unignored_hint, None, "in-app", client_in_app_hint),
        ("app", True, True, unignored_hint, None, "contributes", unignored_hint),
        ("app", True, True, unignored_hint, ignored_because_hint, "in-app", client_in_app_hint),
        ("app", True, True, unignored_hint, ignored_because_hint, "contributes", unignored_hint),
        ("app", True, True, None, None, "in-app", client_in_app_hint),
        ("app", True, True, None, None, "contributes", None),
        ("app", True, True, None, ignored_because_hint, "in-app", client_in_app_hint),
        ("app", True, True, None, ignored_because_hint, "contributes", ignored_because_hint),
        ("app", True, False, in_app_hint, None, "in-app", in_app_hint),
        ("app", True, False, in_app_hint, None, "contributes", None),
        ("app", True, False, in_app_hint, ignored_because_hint, "in-app", in_app_hint),
        ("app", True, False, in_app_hint, ignored_because_hint, "contributes", ignored_because_hint),
        ("app", True, False, out_of_app_hint, None, "in-app", out_of_app_hint),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("app", True, False, out_of_app_hint, None, "contributes", None),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("app", True, False, out_of_app_hint, ignored_because_hint, "in-app", out_of_app_hint),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("app", True, False, out_of_app_hint, ignored_because_hint, "contributes", ignored_because_hint),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("app", True, False, ignored_hint, None, "in-app", None),
        ("app", True, False, ignored_hint, None, "contributes", ignored_hint),
        ("app", True, False, ignored_hint, ignored_because_hint, "in-app", None),
        ("app", True, False, ignored_hint, ignored_because_hint, "contributes", ignored_hint),
        ("app", True, False, unignored_hint, None, "in-app", None),
        ("app", True, False, unignored_hint, None, "contributes", unignored_hint),
        ("app", True, False, unignored_hint, ignored_because_hint, "in-app", None),
        ("app", True, False, unignored_hint, ignored_because_hint, "contributes", unignored_hint),
        ("app", True, False, None, None, "in-app", None),  # impossible - can't have no rust hint if client in-app is changed
        ("app", True, False, None, None, "contributes", None),  # impossible - can't have no rust hint if client in-app is changed
        ("app", True, False, None, ignored_because_hint, "in-app", None),  # impossible - can't have no rust hint if client in-app is changed
        ("app", True, False, None, ignored_because_hint, "contributes", ignored_because_hint),  # impossible - can't have no rust hint if client in-app is changed
        ("app", False, None, in_app_hint, None, "in-app", in_app_hint),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("app", False, None, in_app_hint, None, "contributes", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("app", False, None, in_app_hint, ignored_because_hint, "in-app", in_app_hint),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("app", False, None, in_app_hint, ignored_because_hint, "contributes", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("app", False, None, out_of_app_hint, None, "in-app", out_of_app_hint),
        ("app", False, None, out_of_app_hint, None, "contributes", None),
        ("app", False, None, out_of_app_hint, ignored_because_hint, "in-app", out_of_app_hint),
        ("app", False, None, out_of_app_hint, ignored_because_hint, "contributes", None),
        ("app", False, None, ignored_hint, None, "in-app", default_system_frame_hint),
        ("app", False, None, ignored_hint, None, "contributes", None),
        ("app", False, None, ignored_hint, ignored_because_hint, "in-app", default_system_frame_hint),
        ("app", False, None, ignored_hint, ignored_because_hint, "contributes", None),
        ("app", False, None, unignored_hint, None, "in-app", default_system_frame_hint),
        ("app", False, None, unignored_hint, None, "contributes", None),
        ("app", False, None, unignored_hint, ignored_because_hint, "in-app", default_system_frame_hint),
        ("app", False, None, unignored_hint, ignored_because_hint, "contributes", None),
        ("app", False, None, None, None, "in-app", default_system_frame_hint),
        ("app", False, None, None, None, "contributes", None),
        ("app", False, None, None, ignored_because_hint, "in-app", default_system_frame_hint),
        ("app", False, None, None, ignored_because_hint, "contributes", None),
        ("app", False, True, in_app_hint, None, "in-app", in_app_hint),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("app", False, True, in_app_hint, None, "contributes", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("app", False, True, in_app_hint, ignored_because_hint, "in-app", in_app_hint),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("app", False, True, in_app_hint, ignored_because_hint, "contributes", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("app", False, True, out_of_app_hint, None, "in-app", out_of_app_hint),
        ("app", False, True, out_of_app_hint, None, "contributes", None),
        ("app", False, True, out_of_app_hint, ignored_because_hint, "in-app", out_of_app_hint),
        ("app", False, True, out_of_app_hint, ignored_because_hint, "contributes", None),
        ("app", False, True, ignored_hint, None, "in-app", default_system_frame_hint),
        ("app", False, True, ignored_hint, None, "contributes", None),
        ("app", False, True, ignored_hint, ignored_because_hint, "in-app", default_system_frame_hint),
        ("app", False, True, ignored_hint, ignored_because_hint, "contributes", None),
        ("app", False, True, unignored_hint, None, "in-app", default_system_frame_hint),
        ("app", False, True, unignored_hint, None, "contributes", None),
        ("app", False, True, unignored_hint, ignored_because_hint, "in-app", default_system_frame_hint),
        ("app", False, True, unignored_hint, ignored_because_hint, "contributes", None),
        ("app", False, True, None, None, "in-app", default_system_frame_hint),  # impossible - can't have no rust hint if client in-app is changed
        ("app", False, True, None, None, "contributes", None),  # impossible - can't have no rust hint if client in-app is changed
        ("app", False, True, None, ignored_because_hint, "in-app", default_system_frame_hint),  # impossible - can't have no rust hint if client in-app is changed
        ("app", False, True, None, ignored_because_hint, "contributes", None),  # impossible - can't have no rust hint if client in-app is changed
        ("app", False, False, in_app_hint, None, "in-app", client_out_of_app_hint),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("app", False, False, in_app_hint, None, "contributes", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("app", False, False, in_app_hint, ignored_because_hint, "in-app", client_out_of_app_hint),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("app", False, False, in_app_hint, ignored_because_hint, "contributes", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("app", False, False, out_of_app_hint, None, "in-app", client_out_of_app_hint),
        ("app", False, False, out_of_app_hint, None, "contributes", None),
        ("app", False, False, out_of_app_hint, ignored_because_hint, "in-app", client_out_of_app_hint),
        ("app", False, False, out_of_app_hint, ignored_because_hint, "contributes", None),
        ("app", False, False, ignored_hint, None, "in-app", client_out_of_app_hint),
        ("app", False, False, ignored_hint, None, "contributes", None),
        ("app", False, False, ignored_hint, ignored_because_hint, "in-app", client_out_of_app_hint),
        ("app", False, False, ignored_hint, ignored_because_hint, "contributes", None),
        ("app", False, False, unignored_hint, None, "in-app", client_out_of_app_hint),
        ("app", False, False, unignored_hint, None, "contributes", None),
        ("app", False, False, unignored_hint, ignored_because_hint, "in-app", client_out_of_app_hint),
        ("app", False, False, unignored_hint, ignored_because_hint, "contributes", None),
        ("app", False, False, None, None, "in-app", client_out_of_app_hint),
        ("app", False, False, None, None, "contributes", None),
        ("app", False, False, None, ignored_because_hint, "in-app", client_out_of_app_hint),
        ("app", False, False, None, ignored_because_hint, "contributes", None),
        ("system", True, None, in_app_hint, None, "in-app", None),
        ("system", True, None, in_app_hint, None, "contributes", None),
        ("system", True, None, in_app_hint, ignored_because_hint, "in-app", None),
        ("system", True, None, in_app_hint, ignored_because_hint, "contributes", ignored_because_hint),
        ("system", True, None, out_of_app_hint, None, "in-app", None),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("system", True, None, out_of_app_hint, None, "contributes", None),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("system", True, None, out_of_app_hint, ignored_because_hint, "in-app", None),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("system", True, None, out_of_app_hint, ignored_because_hint, "contributes", ignored_because_hint),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("system", True, None, ignored_hint, None, "in-app", None),
        ("system", True, None, ignored_hint, None, "contributes", ignored_hint),
        ("system", True, None, ignored_hint, ignored_because_hint, "in-app", None),
        ("system", True, None, ignored_hint, ignored_because_hint, "contributes", ignored_hint),
        ("system", True, None, unignored_hint, None, "in-app", None),
        ("system", True, None, unignored_hint, None, "contributes", unignored_hint),
        ("system", True, None, unignored_hint, ignored_because_hint, "in-app", None),
        ("system", True, None, unignored_hint, ignored_because_hint, "contributes", unignored_hint),
        ("system", True, None, None, None, "in-app", None),
        ("system", True, None, None, None, "contributes", None),
        ("system", True, None, None, ignored_because_hint, "in-app", None),
        ("system", True, None, None, ignored_because_hint, "contributes", ignored_because_hint),
        ("system", True, True, in_app_hint, None, "in-app", None),
        ("system", True, True, in_app_hint, None, "contributes", None),
        ("system", True, True, in_app_hint, ignored_because_hint, "in-app", None),
        ("system", True, True, in_app_hint, ignored_because_hint, "contributes", ignored_because_hint),
        ("system", True, True, out_of_app_hint, None, "in-app", None),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("system", True, True, out_of_app_hint, None, "contributes", None),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("system", True, True, out_of_app_hint, ignored_because_hint, "in-app", None),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("system", True, True, out_of_app_hint, ignored_because_hint, "contributes", ignored_because_hint),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("system", True, True, ignored_hint, None, "in-app", None),
        ("system", True, True, ignored_hint, None, "contributes", ignored_hint),
        ("system", True, True, ignored_hint, ignored_because_hint, "in-app", None),
        ("system", True, True, ignored_hint, ignored_because_hint, "contributes", ignored_hint),
        ("system", True, True, unignored_hint, None, "in-app", None),
        ("system", True, True, unignored_hint, None, "contributes", unignored_hint),
        ("system", True, True, unignored_hint, ignored_because_hint, "in-app", None),
        ("system", True, True, unignored_hint, ignored_because_hint, "contributes", unignored_hint),
        ("system", True, True, None, None, "in-app", None),
        ("system", True, True, None, None, "contributes", None),
        ("system", True, True, None, ignored_because_hint, "in-app", None),
        ("system", True, True, None, ignored_because_hint, "contributes", ignored_because_hint),
        ("system", True, False, in_app_hint, None, "in-app", None),
        ("system", True, False, in_app_hint, None, "contributes", None),
        ("system", True, False, in_app_hint, ignored_because_hint, "in-app", None),
        ("system", True, False, in_app_hint, ignored_because_hint, "contributes", ignored_because_hint),
        ("system", True, False, out_of_app_hint, None, "in-app", None),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("system", True, False, out_of_app_hint, None, "contributes", None),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("system", True, False, out_of_app_hint, ignored_because_hint, "in-app", None),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("system", True, False, out_of_app_hint, ignored_because_hint, "contributes", ignored_because_hint),  # impossible - rust can't return out of app hint if it marks frame in-app
        ("system", True, False, ignored_hint, None, "in-app", None),
        ("system", True, False, ignored_hint, None, "contributes", ignored_hint),
        ("system", True, False, ignored_hint, ignored_because_hint, "in-app", None),
        ("system", True, False, ignored_hint, ignored_because_hint, "contributes", ignored_hint),
        ("system", True, False, unignored_hint, None, "in-app", None),
        ("system", True, False, unignored_hint, None, "contributes", unignored_hint),
        ("system", True, False, unignored_hint, ignored_because_hint, "in-app", None),
        ("system", True, False, unignored_hint, ignored_because_hint, "contributes", unignored_hint),
        ("system", True, False, None, None, "in-app", None),  # impossible - can't have no rust hint if client in-app is changed
        ("system", True, False, None, None, "contributes", None),  # impossible - can't have no rust hint if client in-app is changed
        ("system", True, False, None, ignored_because_hint, "in-app", None),  # impossible - can't have no rust hint if client in-app is changed
        ("system", True, False, None, ignored_because_hint, "contributes", ignored_because_hint),  # impossible - can't have no rust hint if client in-app is changed
        ("system", False, None, in_app_hint, None, "in-app", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("system", False, None, in_app_hint, None, "contributes", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("system", False, None, in_app_hint, ignored_because_hint, "in-app", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("system", False, None, in_app_hint, ignored_because_hint, "contributes", ignored_because_hint),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("system", False, None, out_of_app_hint, None, "in-app", None),
        ("system", False, None, out_of_app_hint, None, "contributes", None),
        ("system", False, None, out_of_app_hint, ignored_because_hint, "in-app", None),
        ("system", False, None, out_of_app_hint, ignored_because_hint, "contributes", ignored_because_hint),
        ("system", False, None, ignored_hint, None, "in-app", None),
        ("system", False, None, ignored_hint, None, "contributes", ignored_hint),
        ("system", False, None, ignored_hint, ignored_because_hint, "in-app", None),
        ("system", False, None, ignored_hint, ignored_because_hint, "contributes", ignored_hint),
        ("system", False, None, unignored_hint, None, "in-app", None),
        ("system", False, None, unignored_hint, None, "contributes", unignored_hint),
        ("system", False, None, unignored_hint, ignored_because_hint, "in-app", None),
        ("system", False, None, unignored_hint, ignored_because_hint, "contributes", unignored_hint),
        ("system", False, None, None, None, "in-app", None),
        ("system", False, None, None, None, "contributes", None),
        ("system", False, None, None, ignored_because_hint, "in-app", None),
        ("system", False, None, None, ignored_because_hint, "contributes", ignored_because_hint),
        ("system", False, True, in_app_hint, None, "in-app", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("system", False, True, in_app_hint, None, "contributes", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("system", False, True, in_app_hint, ignored_because_hint, "in-app", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("system", False, True, in_app_hint, ignored_because_hint, "contributes", ignored_because_hint),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("system", False, True, out_of_app_hint, None, "in-app", None),
        ("system", False, True, out_of_app_hint, None, "contributes", None),
        ("system", False, True, out_of_app_hint, ignored_because_hint, "in-app", None),
        ("system", False, True, out_of_app_hint, ignored_because_hint, "contributes", ignored_because_hint),
        ("system", False, True, ignored_hint, None, "in-app", None),
        ("system", False, True, ignored_hint, None, "contributes", ignored_hint),
        ("system", False, True, ignored_hint, ignored_because_hint, "in-app", None),
        ("system", False, True, ignored_hint, ignored_because_hint, "contributes", ignored_hint),
        ("system", False, True, unignored_hint, None, "in-app", None),
        ("system", False, True, unignored_hint, None, "contributes", unignored_hint),
        ("system", False, True, unignored_hint, ignored_because_hint, "in-app", None),
        ("system", False, True, unignored_hint, ignored_because_hint, "contributes", unignored_hint),
        ("system", False, True, None, None, "in-app", None),  # impossible - can't have no rust hint if client in-app is changed
        ("system", False, True, None, None, "contributes", None),  # impossible - can't have no rust hint if client in-app is changed
        ("system", False, True, None, ignored_because_hint, "in-app", None),  # impossible - can't have no rust hint if client in-app is changed
        ("system", False, True, None, ignored_because_hint, "contributes", ignored_because_hint),  # impossible - can't have no rust hint if client in-app is changed
        ("system", False, False, in_app_hint, None, "in-app", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("system", False, False, in_app_hint, None, "contributes", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("system", False, False, in_app_hint, ignored_because_hint, "in-app", None),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("system", False, False, in_app_hint, ignored_because_hint, "contributes", ignored_because_hint),  # impossible - rust can't return in-app hint if it marks frame out of app
        ("system", False, False, out_of_app_hint, None, "in-app", None),
        ("system", False, False, out_of_app_hint, None, "contributes", None),
        ("system", False, False, out_of_app_hint, ignored_because_hint, "in-app", None),
        ("system", False, False, out_of_app_hint, ignored_because_hint, "contributes", ignored_because_hint),
        ("system", False, False, ignored_hint, None, "in-app", None),
        ("system", False, False, ignored_hint, None, "contributes", ignored_hint),
        ("system", False, False, ignored_hint, ignored_because_hint, "in-app", None),
        ("system", False, False, ignored_hint, ignored_because_hint, "contributes", ignored_hint),
        ("system", False, False, unignored_hint, None, "in-app", None),
        ("system", False, False, unignored_hint, None, "contributes", unignored_hint),
        ("system", False, False, unignored_hint, ignored_because_hint, "in-app", None),
        ("system", False, False, unignored_hint, ignored_because_hint, "contributes", unignored_hint),
        ("system", False, False, None, None, "in-app", None),
        ("system", False, False, None, None, "contributes", None),
        ("system", False, False, None, ignored_because_hint, "in-app", None),
        ("system", False, False, None, ignored_because_hint, "contributes", ignored_because_hint),
    ]
    # fmt: on,
)
def test_get_hint_for_frame(
    variant_name: str,
    final_in_app: bool,
    client_in_app: bool | None,
    rust_hint: str | None,
    incoming_hint: str | None,
    desired_hint_type: Literal["in-app", "contributes"],
    expected_result: str | None,
) -> None:

    frame = {"in_app": final_in_app, "data": {"client_in_app": client_in_app}}
    frame_component = FrameGroupingComponent(in_app=final_in_app, hint=incoming_hint, values=[])
    rust_frame = DummyRustFrame(hint=rust_hint)

    assert (
        _get_hint_for_frame(
            variant_name,
            frame,
            frame_component,
            rust_frame,  # type: ignore[arg-type] # rust frame mock fails typecheck
            desired_hint_type,
            set(),
        )
        == expected_result
    )


@pytest.mark.parametrize(
    ["variant_name", "in_app", "contributes", "in_app_hint", "contributes_hint", "expected_result"],
    [
        ("app", True, True, in_app_hint, None, in_app_hint),
        ("app", True, True, in_app_hint, unignored_hint, f"{in_app_hint} and {unignored_hint}"),
        ("app", True, False, in_app_hint, ignored_hint, f"{in_app_hint} but {ignored_hint}"),
        ("app", False, True, out_of_app_hint, None, out_of_app_hint),
        ("app", False, True, out_of_app_hint, unignored_hint, out_of_app_hint),
        ("app", False, False, out_of_app_hint, ignored_hint, out_of_app_hint),
        ("system", True, True, None, None, None),
        ("system", True, True, None, unignored_hint, unignored_hint),
        ("system", True, False, None, ignored_hint, ignored_hint),
        ("system", False, True, None, None, None),
        ("system", False, True, None, unignored_hint, unignored_hint),
        ("system", False, False, None, ignored_hint, ignored_hint),
    ],
)
def test_combining_hints(
    variant_name: str,
    in_app: bool,
    contributes: bool,
    in_app_hint: str | None,
    contributes_hint: str | None,
    expected_result: str | None,
) -> None:
    frame_component = FrameGroupingComponent(in_app=in_app, contributes=contributes, values=[])
    assert (
        _combine_hints(variant_name, frame_component, in_app_hint, contributes_hint)
        == expected_result
    )


def test_adds_rule_source_to_stacktrace_rule_hints() -> None:
    frame = {"in_app": True}
    frame_component = FrameGroupingComponent(in_app=True, values=[])
    custom_rules = {"function:roll_over +app"}

    built_in_rule_rust_frame = DummyRustFrame(
        hint="marked in-app by stack trace rule (function:shake +app)"
    )
    custom_rule_rust_frame = DummyRustFrame(
        hint="marked in-app by stack trace rule (function:roll_over +app)"
    )

    assert (
        _get_hint_for_frame(
            "app",
            frame,
            frame_component,
            built_in_rule_rust_frame,  # type: ignore[arg-type] # rust frame mock fails typecheck
            "in-app",
            custom_rules,
        )
        == "marked in-app by built-in stack trace rule (function:shake +app)"
    )
    assert (
        _get_hint_for_frame(
            "app",
            frame,
            frame_component,
            custom_rule_rust_frame,  # type: ignore[arg-type] # rust frame mock fails typecheck
            "in-app",
            custom_rules,
        )
        == "marked in-app by custom stack trace rule (function:roll_over +app)"
    )
