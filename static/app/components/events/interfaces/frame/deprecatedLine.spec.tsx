import {Event as EventFixture} from 'sentry-fixture/event';
import {Organization} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import DeprecatedLine from 'sentry/components/events/interfaces/frame/deprecatedLine';
import {EntryType, Frame} from 'sentry/types';

describe('Frame - Line', function () {
  const event = EventFixture();

  const data: Frame = {
    absPath: null,
    colNo: null,
    context: [],
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
      render(
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
  });

  describe('ANR suspect frame', () => {
    it('should render suspect frame', () => {
      const org = {...Organization(), features: ['anr-analyze-frames']};
      const eventWithThreads = EventFixture({
        entries: [
          {
            data: {
              values: [
                {
                  id: 13920,
                  current: true,
                  crashed: true,
                  name: 'puma 002',
                  stacktrace: null,
                  rawStacktrace: null,
                  state: 'WAITING',
                },
              ],
            },
            type: EntryType.THREADS,
          },
        ],
      });
      const suspectFrame: Frame = {
        filename: 'Instrumentation.java',
        absPath: 'Instrumentation.java',
        module: 'android.app.Instrumentation',
        package: null,
        platform: null,
        instructionAddr: null,
        symbolAddr: null,
        function: 'callApplicationOnCreate',
        rawFunction: null,
        symbol: null,
        context: [],
        lineNo: 1176,
        colNo: null,
        inApp: false,
        trust: null,
        vars: null,
      };

      render(
        <DeprecatedLine
          data={suspectFrame}
          registers={{}}
          components={[]}
          event={eventWithThreads}
          threadId={13920}
          isANR
          isExpanded
        />,
        {organization: org}
      );
      expect(screen.getByText('Suspect Frame')).toBeInTheDocument();
    });
  });
});
