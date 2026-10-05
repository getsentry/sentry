import {getFormatter} from 'sentry/components/charts/components/tooltip';

describe('getFormatter', () => {
  it('returns DOM nodes rather than an HTML string', () => {
    const formatter = getFormatter({});

    const result = formatter(
      [
        {
          seriesName: 'errors',
          marker: '',
          data: [1700000000000, 5],
          value: [1700000000000, 5],
        },
      ] as any,
      ''
    );

    expect(typeof result).not.toBe('string');
    expect(Array.isArray(result)).toBe(true);
    for (const node of result as HTMLElement[]) {
      expect(node).toBeInstanceOf(HTMLElement);
    }
  });

  it('sanitizes an unescaped markPoint name', () => {
    const formatter = getFormatter({});

    // The markPoint branch interpolates `name` without escaping; a malicious
    // release/version name reaching it is the sink this change closes.
    const result = formatter(
      {
        componentType: 'markPoint',
        name: '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
        data: {coord: [1700000000000, 1], labelForValue: 'Deploy'},
      } as any,
      ''
    ) as HTMLElement[];

    const html = result.map(node => node.outerHTML).join('');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('srcdoc');
    expect(html).not.toContain('<script');
  });
});
