import click


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
        prompt="prompt here",
        message="message here",
    )

    click.echo(llm_response)
