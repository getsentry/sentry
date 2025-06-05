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


class FeedbackSummaryParseError(Exception):
    """Raised when there is an error parsing the AI feedback summary response."""

    pass


@metrics.wraps("feedback.summaries", sample_rate=1.0)
def generate_summary(
    feedbacks,
):
    response = complete_prompt(  # this can throw
        usecase=LLMUseCase.SUMMARIES,
        message=make_input_prompt(feedbacks),
        temperature=0.3,
    )

    if response:
        summary = parse_response(response)  # this can throw a FeedbackSummaryParseError
    else:
        raise Exception("Invalid response from LLM")  # if no response from LLM, this throws

    return summary


def parse_response(
    text,
):
    summary_match = SUMMARY_REGEX.search(text)
    if summary_match:
        summary_text = summary_match.group(1).strip()
        return summary_text
    else:
        logger.error("Error parsing AI feedback summary")
        raise FeedbackSummaryParseError("Error parsing AI feedback summary")
