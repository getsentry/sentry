import logging
import re

from sentry.llm.usecases import LLMUseCase, complete_prompt
from sentry.utils import metrics

logger = logging.getLogger(__name__)


def make_input_prompt(
    feedbacks,
):
    feedbacks_string = "\n".join(f"- {msg}" for msg in feedbacks)
    return f"""**Task**
**Instructions: You are an AI assistant that analyzes customer feedback.
Create a summary based on the user feedbacks that is at most three sentences, and complete the sentence "Users say...". Be concise, but specific in the summary.
Also figure out the top 4 specific sentiments in the messages. These sentiments should be distinct from each other and not the same concept.
After the summary, for each sentiment, also indicate if it is mostly positive or negative.**

**User Feedbacks:**

{feedbacks_string}

**Output Format:** Summary: <1-2 sentence summary>
Key sentiments:
- <sentiment>: positive/negative/neutral
- <sentiment>: positive/negative/neutral
- <sentiment>: positive/negative/neutral
- <sentiment>: positive/negative/neutral
"""


SUMMARY_REGEX = re.compile(r"Summary:(.*?)Key sentiments:", re.DOTALL)
SENTIMENT_REGEX = re.compile(r"- (.*?):\s*(positive|negative|neutral)", re.IGNORECASE)


@metrics.wraps("feedback.summaries", sample_rate=1.0)
def generate_summary(
    feedbacks,
):  # TODO: figure out what params to pass in, whether it is the list of feedbacks, or a string, etc.
    response = complete_prompt(
        usecase=LLMUseCase.SUMMARIES,
        message=make_input_prompt(feedbacks),
        temperature=0.3,
        # max_output_tokens=20,
    )
    if response:
        parsing_successful, summary, sentiments = parse_response(response)

    return parsing_successful, summary, sentiments


def parse_response(
    text,
):  # Boolean (for if parsing was successful or not), string, list - maybe change the return type
    summary_match = SUMMARY_REGEX.search(text)
    if summary_match:
        summary_text = summary_match.group(1).strip()
    else:
        logger.error("Error parsing AI feedback summary")
        return False, "", []

    sentiments = SENTIMENT_REGEX.findall(text)
    if sentiments:
        return True, summary_text, sentiments
    else:
        logger.error("Error parsing AI feedback key sentiments")
        return False, "", []


# TODO: make corresponding feature flag and function for user feedback summaries
# def spam_detection_enabled(project: Project) -> bool:
#     return features.has(
#         "organizations:user-feedback-spam-ingest", project.organization
#     ) and project.get_option("sentry:feedback_ai_spam_detection")
