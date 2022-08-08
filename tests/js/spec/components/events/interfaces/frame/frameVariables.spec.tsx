import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {FrameVariables} from 'sentry/components/events/interfaces/frame/frameVariables';

describe('Frame Variables', function () {
  it('renders', async function () {
    render(
      <FrameVariables
        data={{
          "'client'": '',
          "'data'": null,
          "'k'": '',
          "'options'": {
            "'data'": null,
            "'tags'": null,
          },
        }}
        meta={{
          "'client'": {
            '': {
              rem: [['project:3', 's', 0, 0]],
              len: 41,
              chunks: [
                {
                  type: 'redaction',
                  text: '',
                  rule_id: 'project:3',
                  remark: 's',
                },
              ],
            },
          },
          "'k'": {
            '': {
              rem: [['project:3', 's', 0, 0]],
              len: 12,
              chunks: [
                {
                  type: 'redaction',
                  text: '',
                  rule_id: 'project:3',
                  remark: 's',
                },
              ],
            },
          },
        }}
      />
    );

    expect(screen.getAllByText(/redacted/)).toHaveLength(2);
    userEvent.hover(screen.getAllByText(/redacted/)[0]);
    expect(
      await screen.findByText('Replaced because of PII rule "project:3"')
    ).toBeInTheDocument(); // tooltip description
  });
});
