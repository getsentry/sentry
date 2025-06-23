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

You are an assistant that summarizes customer feedback. Given a list of customer feedback entries, generate a concise, one sentence summary, where you summarize the broader themes that represent the list of feedbacks that you are given.

Your goal is to help someone quickly understand the main patterns or themes that represent the feedback entries. Don't mention ANY specific examples of themes. The summary should remain broad.

Begin the summary with "Users...", for example, "Users say...". Don't make overly generic statements like "Users report a variety of issues."

The summary must be AT MOST 35 words, that is an absolute upper limit, and you must write AT MOST one sentence. You can leave certain things out, and when deciding what topics/themes to mention, make sure it is proportional to the number of times they appear in different customer feedback entries.

User Feedbacks:

{feedbacks_string}

Output Format:

<1 sentence summary>
"""


@metrics.wraps("feedback.summaries", sample_rate=1.0)
def generate_summary(
    feedbacks: list[str],
):
    response = complete_prompt(  # This can throw
        usecase=LLMUseCase.FEEDBACK_SUMMARIES,
        message=make_input_prompt(feedbacks),
        temperature=0.1,
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
