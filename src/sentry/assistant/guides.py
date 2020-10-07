from __future__ import absolute_import


# Guide Schema
# id (text, required): unique id
# required_targets (list): An empty list will cause the guide to be shown regardless
#                          of page/targets presence.
# steps (list): List of steps

# Step Schema
# title (text, required): Title text. Tone should be active.
# message (text, optional): Message text. Should help illustrate how to do a task, not
#                           just literally what the button does.
# target (text, optional): step is tied to an anchor target. If the anchor doesn't exist,
#                          the step will not be shown. if the anchor exists but is of type
#                         "invisible", it will not be pinged but will be scrolled to.
#                          otherwise the anchor will be pinged and scrolled to. If you'd like
#                          your step to show always or have a step is not tied to a specific
#                          element but you'd still like it to be shown, set this as None.

GUIDES = {
    "issue": {"id": 1, "required_targets": ["issue_title", "exception"]},
    "issue_stream": {"id": 3, "required_targets": ["issue_stream"]},
    "dynamic_counts": {"id": 7, "required_targets": ["dynamic_counts"]},
}
