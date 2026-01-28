import {ThemeProvider} from '@emotion/react';
import {ThemeFixture} from 'sentry-fixture/theme';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {Tag} from '@sentry/scraps/badge';

import {useRenderToString} from './renderToString';

const theme = ThemeFixture();

describe('renderToString', () => {
  it('should render a simple component to string', async () => {
    function SimpleComponent() {
      return <div>Hello, World!</div>;
    }

    const {result} = renderHook(() => useRenderToString());

    const string = await act(() => result.current(<SimpleComponent />));

    expect(string).toMatchInlineSnapshot('"<div>Hello, World!</div>"');
  });
  it('should render a scraps component to string', async () => {
    function ScrapsComponent() {
      return <Tag variant="success">SuccessTag</Tag>;
    }

    const {result} = renderHook(() => useRenderToString(), {
      wrapper: ({children}) => <ThemeProvider theme={theme}>{children}</ThemeProvider>,
    });

    const string = await act(() => result.current(<ScrapsComponent />));

    expect(string).toContain('data-test-id="tag-background"');
    expect(string).toContain('SuccessTag');
  });
});
