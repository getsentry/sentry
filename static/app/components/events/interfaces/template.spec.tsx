import {EventFixture} from 'sentry-fixture/event';
import {FrameFixture} from 'sentry-fixture/frame';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Template} from 'sentry/components/events/interfaces/template';
import {EntryType} from 'sentry/types/event';

it('renders template source context expanded in the new stack trace', () => {
  const frame = FrameFixture({
    platform: 'python',
    filename: 'template.html',
    context: [[3, '{{ example.value }}']],
    lineNo: 3,
    vars: {example: 'value'},
  });
  render(
    <Template
      data={frame}
      event={EventFixture({
        platform: 'python',
        entries: [{type: EntryType.TEMPLATE, data: frame}],
      })}
    />
  );
  expect(screen.getByText('Template')).toBeInTheDocument();
  expect(screen.getByText('{{ example.value }}')).toBeInTheDocument();
  expect(screen.getByTestId('core-stacktrace-frame-row')).toBeInTheDocument();
});

it('preserves redaction metadata on template variables', () => {
  const frame = FrameFixture({platform: 'python', vars: {password: ''}});
  render(
    <Template
      data={frame}
      event={EventFixture({
        platform: 'python',
        entries: [{type: EntryType.TEMPLATE, data: frame}],
        _meta: {
          entries: {
            0: {
              data: {
                values: {
                  vars: {password: {'': {rem: [['!config', 's', 0, 0]]}}},
                },
              },
            },
          },
        },
      })}
    />
  );

  expect(screen.getByText(/redacted/)).toBeVisible();
});
