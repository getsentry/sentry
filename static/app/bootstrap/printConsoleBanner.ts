export function printConsoleBanner(color: string, fontFamily: string) {
  // eslint-disable-next-line no-console
  console.log(
    `%c
       ██████╗ ███████╗███╗   ██╗████████╗██████╗ ██╗   ██╗
      ██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██╔══██╗╚██╗ ██╔╝
      ╚█████╗  █████╗  ██╔██╗ ██║   ██║   ██████╔╝ ╚████╔╝
       ╚═══██╗ ██╔══╝  ██║╚██╗██║   ██║   ██╔══██╗  ╚██╔╝
      ██████╔╝ ███████╗██║ ╚████║   ██║   ██║  ██║   ██║
      ╚═════╝  ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝

      👋 Hey, you opened the console!

      Found a bug?
      Yeah, we probably know about it. We literally built a company
      around finding and fixing bugs. The irony isn't lost on us.

      📚 Docs: https://docs.sentry.io/
      💬 Ideas? Complaints? Hot takes? https://github.com/getsentry/sentry/discussions

      Like poking around in dev tools? We like that about you.
      We're hiring: https://sentry.io/careers/
      (We have snacks. And opinions about error handling.)`,
    `color: ${color}; font-family: ${fontFamily};`
  );
}
