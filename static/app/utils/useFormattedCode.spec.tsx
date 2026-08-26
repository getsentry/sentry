import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useFormattedCode} from 'sentry/utils/useFormattedCode';

describe('useFormattedCode', () => {
  it('returns trimmed code without loading a formatter when disabled', () => {
    const {result} = renderHookWithProviders(() =>
      useFormattedCode({
        code: '\n  plain text  \n',
        language: null,
      })
    );

    expect(result.current).toEqual({
      formattedCode: 'plain text',
      isPending: false,
    });
  });

  it('uses the source as a fallback while lazily formatting JavaScript', async () => {
    const {result} = renderHookWithProviders(() =>
      useFormattedCode({
        code: 'function x(){return 1;}',
        language: 'javascript',
        options: {
          indent_size: 2,
          e4x: true,
          brace_style: 'preserve-inline',
        },
      })
    );

    expect(result.current).toEqual({
      formattedCode: 'function x(){return 1;}',
      isPending: true,
    });

    await waitFor(() =>
      expect(result.current).toEqual({
        formattedCode: 'function x() { return 1; }',
        isPending: false,
      })
    );
  });

  it('formats HTML and embedded JavaScript', async () => {
    const {result} = renderHookWithProviders(() =>
      useFormattedCode({
        code: '<main><script>function x(){return 1;}</script></main>',
        language: 'html',
        options: {indent_size: 2},
      })
    );

    await waitFor(() =>
      expect(result.current.formattedCode).toBe(
        '<main>\n' +
          '  <script>\n' +
          '    function x() {\n' +
          '      return 1;\n' +
          '    }\n' +
          '  </script>\n' +
          '</main>'
      )
    );
  });
});
