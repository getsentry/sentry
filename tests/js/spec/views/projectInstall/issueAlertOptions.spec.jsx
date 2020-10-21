import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  MOCK_RESP_VERBOSE,
  MOCK_RESP_INCONSISTENT_INTERVALS,
  MOCK_RESP_INCONSISTENT_PLACEHOLDERS,
  MOCK_RESP_ONLY_IGNORED_CONDITIONS_INVALID,
} from 'sentry-test/fixtures/ruleConditions';

import IssueAlertOptions from 'app/views/projectInstall/issueAlertOptions';

describe('IssueAlertOptions', function () {
  const {organization, routerContext} = initializeOrg();
  const URL = `/projects/${organization.slug}/rule-conditions/`;
  let props;
  const baseProps = {
    onChange: _ => {},
  };
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/rule-conditions/`,
      body: MOCK_RESP_VERBOSE,
    });
    props = {...baseProps};
  });

  const selectControlVerifier = (wrapper, dataTestId, optionsText) => {
    wrapper
      .find(`[data-test-id="${dataTestId}"] input[id*="react-select"]`)
      .last()
      .simulate('focus');

    expect(
      wrapper.find(`InlineSelectControl[data-test-id="${dataTestId}"] Option`)
    ).toHaveLength(optionsText.length);

    optionsText.forEach((metricText, idx) =>
      expect(
        wrapper
          .find(`InlineSelectControl[data-test-id="${dataTestId}"] Option`)
          .at(idx)
          .text()
      ).toBe(metricText)
    );
  };

  it('should render only the `Default Rule` and `Create Later` option on empty response:[]', () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: [],
    });

    const wrapper = mountWithTheme(<IssueAlertOptions {...props} />, routerContext);
    expect(wrapper.find('RadioLineItem')).toHaveLength(2);
  });

  it('should render only the `Default Rule` and `Create Later` option on empty response:{}', () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: {},
    });

    const wrapper = mountWithTheme(<IssueAlertOptions {...props} />, routerContext);
    expect(wrapper.find('RadioLineItem')).toHaveLength(2);
  });

  it('should render only the `Default Rule` and `Create Later` option on responses with different allowable intervals', () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_INCONSISTENT_INTERVALS,
    });

    const wrapper = mountWithTheme(<IssueAlertOptions {...props} />, routerContext);
    expect(wrapper.find('RadioLineItem')).toHaveLength(2);
  });

  it('should render all(three) options on responses with different placeholder values', () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_INCONSISTENT_PLACEHOLDERS,
    });
    const wrapper = mountWithTheme(<IssueAlertOptions {...props} />, routerContext);
    expect(wrapper.find('RadioLineItem')).toHaveLength(3);
  });

  it('should ignore conditions that are not `sentry.rules.conditions.event_frequency.EventFrequencyCondition` and `sentry.rules.conditions.event_frequency.EventUniqueUserFrequencyCondition` ', () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_ONLY_IGNORED_CONDITIONS_INVALID,
    });

    const wrapper = mountWithTheme(<IssueAlertOptions {...props} />, routerContext);
    expect(wrapper.find('RadioLineItem')).toHaveLength(3);
    selectControlVerifier(wrapper, 'metric-select-control', ['users affected by']);
  });

  it('should render all(three) options on a valid response', () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_VERBOSE,
    });

    const wrapper = mountWithTheme(<IssueAlertOptions {...props} />, routerContext);
    expect(wrapper.find('RadioLineItem')).toHaveLength(3);
  });

  it('should pre-populate fields from server response', () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_VERBOSE,
    });

    const wrapper = mountWithTheme(<IssueAlertOptions {...props} />, routerContext);

    [
      ['metric-select-control', ['occurrences of', 'users affected by']],
      [
        'interval-select-control',
        ['one minute', 'one hour', 'one day', 'one week', '30 days'],
      ],
    ].forEach(([dataTestId, options]) =>
      selectControlVerifier(wrapper, dataTestId, options)
    );
  });

  it('should not pre-fill threshold value after a valid server response', () => {
    MockApiClient.addMockResponse({
      url: URL,
      body: MOCK_RESP_VERBOSE,
    });

    const wrapper = mountWithTheme(<IssueAlertOptions {...props} />, routerContext);

    expect(wrapper.find('input[data-test-id="range-input"]').props().value).toBe('');
  });
});
