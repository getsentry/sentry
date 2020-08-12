import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import Frame from 'app/components/events/interfaces/frame/frame';

describe('Frame', function() {
  let data;

  describe('renderOriginalSourceInfo()', function() {
    beforeEach(function() {
      data = {
        origAbsPath: 'https://beta.getsentry.com/_static/sentry/dist/vendor.js',
        origColNo: 2503,
        origFilename: '/_static/sentry/dist/vendor.js',
        origFunction: 'T._updateRenderedComponent',
        origLineNo: 419,
        map: 'vendor.js.map',
        mapUrl: 'https://beta.getsentry.com/_static/sentry/dist/vendor.js.map',
      };
    });

    it('should render the source map information as a HTML string', function() {
      const frame = mountWithTheme(<Frame data={data} components={[]} />);

      expect(frame.find('Tooltip').prop('title')).toMatchSnapshot();
    });
  });

  describe('renderContext()', () => {
    it('should render context lines', () => {
      data = {
        context: [
          [211, '    # Mark the crashed thread and add its stacktrace to the exception'],
          [212, "    crashed_thread = data['threads'][state.requesting_thread]"],
          [213, "    crashed_thread['crashed'] = True"],
        ],
      };

      const frame = mountWithTheme(<Frame data={data} components={[]} isExpanded />);
      expect(frame.find('ContextLine')).toSnapshot();
    });

    it('should render register values', () => {
      data = {};
      const registers = {
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
      };

      const frame = mountWithTheme(
        <Frame data={data} registers={registers} components={[]} isExpanded />
      );
      expect(frame.find('FrameRegisters').prop('data')).toEqual(registers);
    });

    it('should not render empty registers', () => {
      data = {};
      const registers = {};

      const frame = mountWithTheme(
        <Frame data={data} registers={registers} components={[]} isExpanded />
      );
      expect(frame.find('FrameRegisters')).toHaveLength(0);
    });

    it('should render context vars', () => {
      data = {
        vars: {
          origin: null,
          helper: '<sentry.coreapi.MinidumpApiHelper object at 0x10e157ed0>',
          self: '<sentry.web.api.MinidumpView object at 0x10e157250>',
          args: [],
          request: '<WSGIRequest at 0x4531253712>',
          content: '[Filtered]',
          kwargs: {},
          project_id: "u'3'",
        },
      };

      const frame = mountWithTheme(<Frame data={data} components={[]} isExpanded />);
      expect(frame.find('FrameVariables').prop('data')).toEqual(data.vars);
    });
  });
});
