describe('getDynamicText', function () {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders actual value', async function () {
    vi.doMock('sentry/constants', () => ({
      IS_ACCEPTANCE_TEST: false,
    }));
    const {default: getDynamicText} = await vi.importActual(
      'sentry/utils/getDynamicText'
    );

    expect(
      getDynamicText({
        fixed: 'Text',
        value: 'Dynamic Content',
      })
    ).toBe('Dynamic Content');
  });

  it('renders fixed content when `app/constants/IS_ACCEPTANCE_TEST` is true', async function () {
    vi.doMock('sentry/constants', () => ({
      IS_ACCEPTANCE_TEST: true,
    }));
    const {default: getDynamicText} = await vi.importActual(
      'sentry/utils/getDynamicText'
    );

    expect(
      getDynamicText({
        fixed: 'Text',
        value: 'Dynamic Content',
      })
    ).toBe('Text');
  });
});
