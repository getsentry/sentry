import {EventFixture} from 'sentry-fixture/event';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CrashContent} from 'sentry/components/events/interfaces/crashContent';
import {withMeta} from 'sentry/components/events/meta/metaProxy';
import {StackType, StackView} from 'sentry/types/stacktrace';

function ExceptionWithMeta(params = {}) {
  return {
    level: 'error',
    platform: 'python',
    exception: {
      values: [
        {
          type: 'ValueError',
          value: 'python err A949AE01EBB07300D62AE0178F0944DD21F8C98C err',
          module: 'exceptions',
          stacktrace: {
            frames: [],
          },
        },
      ],
    },
    _meta: {
      exception: {
        values: {
          0: {
            value: {
              '': {
                len: 29,
                rem: [['device_id', 'p', 11, 51]],
              },
            },
          },
        },
      },
    },
    ...params,
  };
}

function renderMockRequests({orgSlug}: {orgSlug: string}) {
  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/projects/`,
    method: 'GET',
    body: [],
  });
}

describe('CrashContent', function () {
  const exc = ExceptionWithMeta();
  const proxiedExc = withMeta(exc);

  it('renders with meta data', async function () {
    renderMockRequests({orgSlug: ProjectFixture().organization.slug});

    render(
      <CrashContent
        stackView={StackView.FULL}
        stackType={StackType.ORIGINAL}
        event={EventFixture()}
        newestFirst
        exception={(proxiedExc as any).exception}
        projectSlug={ProjectFixture().slug}
      />
    );

    expect(await screen.findByTestId('exception-value')).toBeInTheDocument();
  });
});
