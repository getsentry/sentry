import {getOpaqueColorFromComposite} from 'sentry/views/preprod/components/visualizations/appSizeTreemapTheme';

function parseRgbString(colorValue: string): [number, number, number] {
  const match = colorValue.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);

  if (!match) {
    throw new Error(`Invalid color value: ${colorValue}`);
  }

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

describe('getOpaqueColorFromComposite', () => {
  it('returns foreground color when foreground is fully opaque', () => {
    const result = getOpaqueColorFromComposite('rgb(10, 20, 30)', 'rgb(40, 50, 60)');

    expect(parseRgbString(result)).toEqual([10, 20, 30]);
  });

  it('composites a semi-transparent foreground over background', () => {
    const result = getOpaqueColorFromComposite(
      'rgba(200, 100, 0, 0.25)',
      'rgb(40, 20, 240)'
    );

    expect(parseRgbString(result)).toEqual([80, 40, 180]);
  });

  it('returns background when foreground is fully transparent', () => {
    const result = getOpaqueColorFromComposite('rgba(200, 100, 0, 0)', 'rgb(40, 50, 60)');

    expect(parseRgbString(result)).toEqual([40, 50, 60]);
  });
});
