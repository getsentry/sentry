type IntlFormatterConstructor<Formatter, Options> = new (
  locale: string,
  options?: Options
) => Formatter;

const formattersByConstructor = new Map<unknown, Map<string, unknown>>();

/**
 * Constructing an Intl formatter costs far more than formatting with one, and
 * dates render in large tables and on every relative-time tick. Formatters are
 * reused per locale and options. The set stays small: a session uses few
 * locales, timezones, and option shapes.
 */
export function getIntlFormatter<Formatter, Options>(
  Constructor: IntlFormatterConstructor<Formatter, Options>,
  locale: string,
  options: NoInfer<Options>
): Formatter {
  let formatters = formattersByConstructor.get(Constructor);
  if (!formatters) {
    formatters = new Map();
    formattersByConstructor.set(Constructor, formatters);
  }
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key) as Formatter | undefined;
  if (!formatter) {
    formatter = new Constructor(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}
