describe('getDynamicText', function () {
  beforeEach(() => {
    jest.resetModules();
  });

  it('renders actual value', function () {
    jest.doMock('app/constants', () => ({
      IS_ACCEPTANCE_TEST: false,
    }));
    const getDynamicText = require('app/utils/getDynamicText').default;

    expect(
      getDynamicText({
        fixed: 'Text',
        value: 'Dynamic Content',
      })
    ).toEqual('Dynamic Content');
  });

  it('renders fixed content when `app/constants/IS_ACCEPTANCE_TEST` is true', function () {
    jest.doMock('app/constants', () => ({
      IS_ACCEPTANCE_TEST: true,
    }));
    const getDynamicText = require('app/utils/getDynamicText').default;

    expect(
      getDynamicText({
        fixed: 'Text',
        value: 'Dynamic Content',
      })
    ).toEqual('Text');
  });
});
