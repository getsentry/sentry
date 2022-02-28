import {render, screen} from 'sentry-test/reactTestingLibrary';

import Tag from 'sentry/components/tagDeprecated';

describe('Tag (deprecated)', function () {
  it('renders', async function () {
    const {container} = render(
      <Tag priority="info" border size="small">
        Text to Copy
      </Tag>
    );

    expect(await screen.findByText('Text to Copy')).toBeInTheDocument();

    expect(container).toSnapshot();
  });
});
