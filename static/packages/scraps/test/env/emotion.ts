/**
 * Emotion injects its styles through the CSSOM (`insertRule`), so they are not
 * reflected in `getComputedStyle` under jsdom. Read the generated rules for an
 * element directly off `document.styleSheets` instead.
 */
export function getEmotionRules(element: HTMLElement): string[] {
  // Emotion (`css-…`) and StyleX (atomic `x…`) class names.
  const classes = element.className
    .split(' ')
    .filter(cls => cls.startsWith('css-') || /^x[a-z0-9]{5,}$/.test(cls));
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let sheetRules: CSSRuleList;
    try {
      sheetRules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(sheetRules)) {
      if (classes.some(cls => new RegExp(`\\.${cls}(?![\\w-])`).test(rule.cssText))) {
        // CSSOM formatting varies between DOM implementations. Tests care about
        // the generated declarations, not whether an at-rule contains newlines.
        rules.push(
          rule.cssText
            .replace(/\s+/g, ' ')
            // StyleX layout props read their value from an inline variable.
            .replace(
              /var\((--sx-[\w-]+)\)/g,
              (match, name: string) => element.style.getPropertyValue(name) || match
            )
        );
      }
    }
  }
  return rules;
}
