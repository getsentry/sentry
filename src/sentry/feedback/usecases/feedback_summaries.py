import logging
import re

from sentry.llm.usecases import LLMUseCase, complete_prompt
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def make_input_prompt(
    feedbacks,
):
    feedbacks_string = "\n".join(f"- {msg}" for msg in feedbacks)
    return f"""Task:
Instructions: You are an AI assistant that analyzes customer feedback.
Create a summary based on the user feedbacks that is at most three sentences, and complete the sentence "Users say...". Be concise, but specific in the summary.

User Feedbacks:

{feedbacks_string}

Output Format:

Summary: <1-3 sentence summary>
"""


SUMMARY_REGEX = re.compile(r"Summary:\s*(.*)", re.DOTALL)


@metrics.wraps("feedback.summaries", sample_rate=1.0)
def generate_summary(
    feedbacks: list[str],
):
    response = complete_prompt(  # This can throw
        usecase=LLMUseCase.FEEDBACK_SUMMARIES,
        message=make_input_prompt(feedbacks),
        temperature=0.3,
        max_output_tokens=150,
    )

    if response:
        summary = parse_response(response)
    else:
        raise ValueError("Invalid response from LLM")

    return summary


def parse_response(
    text,
):
    summary_match = SUMMARY_REGEX.search(text)
    if summary_match:
        raw_summary_text = summary_match.group(1)
        summary_text = re.sub(r"\s+", " ", raw_summary_text).strip()
        return summary_text
    else:
        raise ValueError("Failed to parse AI feedback summary response")
