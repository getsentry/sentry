import click

from sentry.taskdemo import say_hello


def produce_activations(num_activations: int):
    for i in range(num_activations):
        say_hello.delay(f"{i}")


@click.option(
    "--num-activations",
    type=int,
    default=1,
    show_default=True,
    help="Number of task activations to send to kafka",
)
def main(num_activations: int):
    produce_activations(num_activations)


if __name__ == "__main__":
    main()
