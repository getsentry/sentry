import {createRef} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {RepoPRState} from 'sentry/views/seerExplorer/types';

import {InputSection} from './inputSection';

const REPO = 'acme/web';
const REPO_PR_STATES: Record<string, RepoPRState> = {
  [REPO]: {
    repo_name: REPO,
    branch_name: 'seer/add-cart-logging',
    commit_sha: 'abc123',
    pr_creation_error: null,
    pr_creation_status: 'completed',
    pr_id: 999,
    pr_number: 482,
    pr_url: 'https://github.com/acme/web/pull/482',
    title: 'Add cart total logging',
  },
};

function makeProps(
  overrides: Partial<React.ComponentProps<typeof InputSection>> = {}
): React.ComponentProps<typeof InputSection> {
  return {
    composerRef: createRef(),
    enabled: true,
    inputValue: {text: '', mentions: []},
    onInputChange: jest.fn(),
    onInputClick: jest.fn(),
    onInterrupt: jest.fn(),
    onKeyDown: jest.fn(),
    onSend: jest.fn(),
    repoPRStates: REPO_PR_STATES,
    ...overrides,
  };
}

describe('InputSection', () => {
  it('ignores the approval shortcuts while they are off', async () => {
    const fileApprovalActions = {
      currentIndex: 0,
      totalPatches: 1,
      onApprove: jest.fn(),
      onReject: jest.fn(),
    };
    const {rerender} = render(
      <InputSection {...makeProps({fileApprovalActions, shortcutsEnabled: false})} />
    );

    await userEvent.keyboard('{Enter}{Escape}');
    expect(fileApprovalActions.onApprove).not.toHaveBeenCalled();
    expect(fileApprovalActions.onReject).not.toHaveBeenCalled();

    rerender(<InputSection {...makeProps({fileApprovalActions})} />);
    await userEvent.keyboard('{Enter}');
    expect(fileApprovalActions.onApprove).toHaveBeenCalledTimes(1);
  });

  it('styles the interrupted placeholder with the warning color', () => {
    render(
      <InputSection
        composerRef={createRef()}
        enabled
        inputValue={{text: '', mentions: []}}
        interruptState="completed"
        onInputChange={jest.fn()}
        onInputClick={jest.fn()}
        onInterrupt={jest.fn()}
        onKeyDown={jest.fn()}
        onSend={jest.fn()}
        repoPRStates={{}}
      />
    );

    const editor = screen.getByRole('combobox', {name: 'Ask Seer a question'});
    expect(editor).toHaveAttribute(
      'data-placeholder',
      'Interrupted. What should Seer do instead?'
    );
    const placeholderRules = Array.from(document.styleSheets)
      .flatMap(sheet => Array.from(sheet.cssRules))
      .filter(
        (rule): rule is CSSStyleRule =>
          rule instanceof CSSStyleRule &&
          rule.selectorText.endsWith(':empty::before') &&
          editor.matches(rule.selectorText.replace('::before', ''))
      );
    const expectedStyle = document.createElement('div').style;
    expectedStyle.color = ThemeFixture().tokens.content.warning;
    expect(placeholderRules.at(-1)?.style.color).toBe(expectedStyle.color);
  });

  describe('with ask-seer-create-pr', () => {
    const organization = OrganizationFixture({features: ['ask-seer-create-pr']});

    it('shows the pull requests on a read-only conversation', () => {
      render(<InputSection {...makeProps({enabled: false})} />, {organization});

      expect(screen.getByTestId('seer-explorer-input')).toBeDisabled();
      expect(screen.getByRole('link', {name: 'acme/web#482'})).toBeInTheDocument();
    });
  });
});
