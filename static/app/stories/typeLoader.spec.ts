import {extractRequest, isDocumentedProp} from 'sentry/stories/typeLoader';

describe('isDocumentedProp', () => {
  it.each(['__@iterator@123', '__@hasInstance@987', '__@metadata@456'])(
    'filters the unstable TypeScript property %s',
    name => {
      expect(isDocumentedProp({name})).toBe(false);
    }
  );

  it('keeps regular component properties', () => {
    expect(isDocumentedProp({name: 'children'})).toBe(true);
  });
});

describe('extractRequest', () => {
  const rootContext = '/checkout/sentry/static';
  const contextify = (context: string, request: string) =>
    `./${request.slice(context.length + 1)}`;

  it.each([
    [
      '/checkout/sentry/static/app/components/core/button/index.tsx',
      '@sentry/scraps/button',
    ],
    [
      '/checkout/sentry/static/app/components/dropdownMenu/index.tsx',
      'sentry/components/dropdownMenu',
    ],
    [
      '/checkout/sentry/static/app/views/dashboards/widgets/widget/widget.tsx',
      'sentry/views/dashboards/widgets/widget/widget',
    ],
  ])('creates the public request for %s', (resourcePath, expected) => {
    expect(extractRequest(resourcePath, rootContext, contextify)).toBe(expected);
  });
});
