import {createRef} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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

  it('shows a notice above the composer', () => {
    render(<InputSection {...makeProps({notice: 'Out of credits'})} />);

    const notice = screen.getByText('Out of credits');
    expect(
      notice.compareDocumentPosition(screen.getByTestId('seer-explorer-input')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('leaves the notice out while a question replaces the composer', () => {
    render(
      <InputSection
        {...makeProps({
          notice: 'Out of credits',
          questionActions: {
            canSubmit: true,
            currentIndex: 0,
            onBack: jest.fn(),
            onMoveDown: jest.fn(),
            onMoveUp: jest.fn(),
            onNext: jest.fn(),
            totalQuestions: 1,
          },
        })}
      />
    );

    expect(screen.getByText('Asking some questions...')).toBeInTheDocument();
    expect(screen.queryByText('Out of credits')).not.toBeInTheDocument();
  });

  it('shows toolbar items between the composer and the send button', () => {
    render(<InputSection {...makeProps({toolbarItems: 'Toolbar item'})} />);

    const item = screen.getByText('Toolbar item');
    expect(
      screen.getByTestId('seer-explorer-input').compareDocumentPosition(item) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      item.compareDocumentPosition(screen.getByRole('button', {name: 'Send message'})) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('keeps toolbar items while Seer is responding', () => {
    render(
      <InputSection
        {...makeProps({toolbarItems: 'Toolbar item', interruptState: 'can-interrupt'})}
      />
    );

    expect(screen.getByText('Toolbar item')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Interrupt button'})).toBeInTheDocument();
  });

  it('leaves toolbar items out of a read-only conversation', () => {
    render(
      <InputSection {...makeProps({toolbarItems: 'Toolbar item', enabled: false})} />
    );

    expect(screen.queryByText('Toolbar item')).not.toBeInTheDocument();
  });

  describe('with ask-seer-create-pr', () => {
    const organization = OrganizationFixture({features: ['ask-seer-create-pr']});

    it('shows the pull requests on a read-only conversation', () => {
      render(<InputSection {...makeProps({enabled: false})} />, {organization});

      expect(screen.getByTestId('seer-explorer-input')).toBeDisabled();
      expect(screen.getByRole('button', {name: 'acme/web#482'})).toBeInTheDocument();
    });
  });

  it('shows the pull requests on an Autofix single run without ask-seer-create-pr', () => {
    render(<InputSection {...makeProps({isSingleRun: true})} />, {
      organization: OrganizationFixture({features: []}),
    });

    expect(screen.getByRole('button', {name: 'acme/web#482'})).toBeInTheDocument();
  });

  it('hides the pull requests on other runs without ask-seer-create-pr', () => {
    render(<InputSection {...makeProps()} />, {
      organization: OrganizationFixture({features: []}),
    });

    expect(screen.queryByRole('button', {name: 'acme/web#482'})).not.toBeInTheDocument();
  });
});
