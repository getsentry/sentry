import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import DeprecatedLine from 'sentry/components/events/interfaces/frame/deprecatedLine';
import {Frame} from 'sentry/types';

describe('Frame - Line', function () {
  const event = TestStubs.Event();

  const data: Frame = {
    absPath: null,
    colNo: null,
    context: [],
    errors: null,
    filename: null,
    function: null,
    inApp: false,
    instructionAddr: null,
    lineNo: null,
    module: null,
    package: null,
    platform: null,
    rawFunction: null,
    symbol: null,
    symbolAddr: null,
    trust: null,
    vars: null,
  };

  describe('renderOriginalSourceInfo()', function () {
    it('should render the source map information as a HTML string', function () {
      const {container} = render(
        <DeprecatedLine
          data={{
            origAbsPath: 'https://beta.getsentry.com/_static/sentry/dist/vendor.js',
            mapUrl: 'https://beta.getsentry.com/_static/sentry/dist/vendor.js.map',
            map: 'vendor.js.map',
            ...data,
          }}
          registers={{}}
          components={[]}
          event={event}
        />
      );
      expect(container).toSnapshot();
    });
  });

  describe('renderContext()', () => {
    it('should render context lines', () => {
      render(
        <DeprecatedLine
          data={{
            ...data,
            context: [
              [
                211,
                '    # Mark the crashed thread and add its stacktrace to the exception',
              ],
              [212, "    crashed_thread = data['threads'][state.requesting_thread]"],
              [213, "    crashed_thread['crashed'] = True"],
            ],
          }}
          registers={{}}
          components={[]}
          event={event}
          isExpanded
        />
      );
      expect(screen.getByRole('list')).toSnapshot();
    });

    it('should render register values', () => {
      render(
        <DeprecatedLine
          data={data}
          registers={{
            r10: '0x00007fff9300bf70',
            r11: '0xffffffffffffffff',
            r12: '0x0000000000000000',
            r13: '0x0000000000000000',
            r14: '0x000000000000000a',
            r15: '0x0000000000000000',
            r8: '0x00007fff9300bf78',
            r9: '0x0000000000000040',
            rax: '0x00007fff9291e660',
            rbp: '0x00007ffedfdff7e0',
            rbx: '0x00007fff9291e660',
            rcx: '0x0000000000000008',
            rdi: '0x00007ffedfdff790',
            rdx: '0x0000020000000303',
            rip: '0x000000010fe00a59',
            rsi: '0x0000000000000300',
            rsp: '0x00007ffedfdff7c0',
          }}
          components={[]}
          event={event}
          isExpanded
        />
      );
      expect(screen.getByText('Registers')).toBeInTheDocument();
    });

    it('should not render empty registers', () => {
      render(
        <DeprecatedLine
          data={data}
          registers={{}}
          components={[]}
          event={event}
          isExpanded
        />
      );

      expect(screen.queryByText('Registers')).not.toBeInTheDocument();
    });

    it('should render context vars', () => {
      const vars = {
        origin: null,
        helper: '<sentry.coreapi.MinidumpApiHelper object at 0x10e157ed0>',
        self: '<sentry.web.api.MinidumpView object at 0x10e157250>',
        args: [],
        request: '<WSGIRequest at 0x4531253712>',
        content: '[Filtered]',
        kwargs: {},
        project_id: "u'3'",
      };

      render(
        <DeprecatedLine
          data={{...data, vars}}
          registers={{}}
          components={[]}
          event={event}
          isExpanded
        />
      );

      for (const [key, value] of Object.entries(vars)) {
        const row = screen.getByText(key).closest('tr');
        expect(row).toBeTruthy();

        if (!row) {
          return;
        }

        const utils = within(row);
        expect(utils.getByText(key)).toBeInTheDocument();

        if (typeof value !== 'string') {
          return;
        }

        expect(utils.getByText(value)).toBeInTheDocument();
      }
    });

    it('should render sourcemap debug', async () => {
      const org = TestStubs.Organization();
      const project = TestStubs.Project();
      const filename = 'something.js';
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/events/event-id/source-map-debug/`,
        body: {
          errors: [{type: 'no_release_on_event', message: '', data: null}],
        },
      });
      const {container} = render(
        <DeprecatedLine
          data={{...data, filename}}
          registers={{}}
          components={[]}
          event={event}
          isExpanded
          debugFrames={[
            {
              filename,
              query: {
                eventId: 'event-id',
                exceptionIdx: 0,
                frameIdx: 0,
                orgSlug: 'org-slug',
                projectSlug: 'project-slug',
              },
            },
          ]}
        />,
        {organization: org}
      );
      expect(await screen.findByLabelText('Missing source map')).toBeInTheDocument();
      expect(container).toSnapshot();
    });
  });
});
