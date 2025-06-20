import logging
import re

from sentry.llm.usecases import LLMUseCase, complete_prompt
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def make_input_prompt(
    feedbacks,
):
    feedbacks_string = "\n------\n".join(feedbacks)
    return f"""Instructions:

You are an assistant that summarizes customer feedback. Given a list of customer feedback entries, generate a concise summary of 1-2 sentences that reflects the key themes. Begin the summary with "Users...", for example, "Users say...". Don't make overly generic statements like "Users report a variety of issues."

Balance specificity and generalization based on the size of the input and based only on the themes and topics present in the list of customer feedback entries. Your goal is to focus on identifying and summarizing broader themes that are mentioned more frequently across different feedback entries. For example, if there are many feedback entries, it makes more sense to prioritize mentioning broader themes that apply to many feedbacks, versus mentioning one or two specific isolated concerns and leaving out others that are just as prevalent.

The summary must be AT MOST 55 words, that is an absolute upper limit, and you must write AT MOST two sentences. You can leave certain things out, and when deciding what topics/themes to mention, make sure it is proportional to the number of times they appear in different customer feedback entries.

User Feedbacks:

{feedbacks_string}

Output Format:

<1-2 sentence summary>
"""


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
    return re.sub(r"\s+", " ", text).strip()
