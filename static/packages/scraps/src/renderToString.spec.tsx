import {act, renderHook} from '../test/env';

import {useRenderToString} from './renderToString';
import {Text} from './text';

describe('renderToString', () => {
  it('should render a simple component to string', async () => {
    function SimpleComponent() {
      return <div>Hello, World!</div>;
    }

    const {result} = renderHook(useRenderToString);

    const string = await act(() => result.current(<SimpleComponent />));

    expect(string).toMatchInlineSnapshot('"<div>Hello, World!</div>"');
  });
  it('should render a scraps component to string', async () => {
    function ScrapsComponent() {
      return (
        <Text variant="success" data-test-id="rendered-text">
          SuccessText
        </Text>
      );
    }

    const {result} = renderHook(useRenderToString);

    const string = await act(() => result.current(<ScrapsComponent />));

    expect(string).toContain('data-test-id="rendered-text"');
    expect(string).toContain('SuccessText');
  });
});
