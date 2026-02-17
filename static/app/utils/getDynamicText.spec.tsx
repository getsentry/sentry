describe('getDynamicText', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('renders actual value', async () => {
    jest.doMock('sentry/constants', () => ({
      IS_ACCEPTANCE_TEST: false,
    }));
    const {default: getDynamicText} = await import('sentry/utils/getDynamicText');

    expect(
      getDynamicText({
        fixed: 'Text',
        value: 'Dynamic Content',
      })
    ).toBe('Dynamic Content');
  });

  it('renders fixed content when `app/constants/IS_ACCEPTANCE_TEST` is true', async () => {
    jest.doMock('sentry/constants', () => ({
      IS_ACCEPTANCE_TEST: true,
    }));
    const {default: getDynamicText} = await import('sentry/utils/getDynamicText');

    expect(
      getDynamicText({
        fixed: 'Text',
        value: 'Dynamic Content',
      })
    ).toBe('Text');
  });
});
