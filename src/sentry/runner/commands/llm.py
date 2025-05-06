import click


def make_input_prompt(message: str):
    # if you decide not to lower-case the message, remember to add capitals to the examples
    return f"""**Classification Task**
**Instructions: Please analyze the following input and output `spam` if the input is not coherent, and `notspam` if it is coherent. If the user is frustrated but describing a problem, that is notspam**
**Label Options:** spam, notspam

**Few-shot Examples:**
* **Example 1:** "asdasdfasd" -> spam
* **Example 2:** "it doesn't work," -> notspam
* **Example 3:** "es funktioniert nicht" -> notspam
* **Example 4:** "is there another way to do payment?" -> notspam
* **Example 5:** "this thing does not function how it should" -> notspam
* **Example 6:** "i was playing a great game now it crashed" -> notspam
* **Example 7:** "i can't login to my account wtf??!" -> notspam
* **Example 8:** "ฉันไม่สามารถเข้าสู่ระบบและไม่มีอะไรทำงาน " -> notspam
* **Example 9:** "crashed" -> notspam
* **Example 10:** "my game glitched grrrr!!!!" -> notspam
* **Example 11:** "this piece of junk does not work!!!" -> notspam

**Input Text:** "{message.lower()}"

**Classify:** """


@click.command("llm")
@click.option("--usecase", default="example")
def llm(usecase: str) -> None:
    """
    a quick command tool for testing different LLM providers. make sure your options are set up!
    """
    from sentry.runner import configure

    configure()
    from sentry.llm.usecases import LLMUseCase, complete_prompt

    llm_response = complete_prompt(
        usecase=LLMUseCase(usecase),
        message=make_input_prompt("this thing does not function how it should"),
        temperature=0,
        max_output_tokens=20,
    )

    click.echo(llm_response)
