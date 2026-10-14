/**
 * Emotion injects its styles through the CSSOM (`insertRule`), so they are not
 * reflected in `getComputedStyle` under jsdom. Read the generated rules for an
 * element directly off `document.styleSheets` instead.
 */
export function getEmotionRules(element: HTMLElement): string[] {
  const classes = element.className.split(' ').filter(cls => cls.startsWith('css-'));
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let sheetRules: CSSRuleList;
    try {
      sheetRules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(sheetRules)) {
      if (classes.some(cls => rule.cssText.includes(cls))) {
        // CSSOM formatting varies between DOM implementations. Tests care about
        // the generated declarations, not whether an at-rule contains newlines.
        rules.push(rule.cssText.replace(/\s+/g, ' '));
      }
    }
  }
  return rules;
}
