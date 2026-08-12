import {render, screen} from 'sentry-test/reactTestingLibrary';

import {localStorageWrapper} from 'sentry/utils/localStorage';
import {IssueDetailsContextProvider, SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {generateTelemetryCSS, TelemetryLayoutStyles} from './telemetrySections';

describe('generateTelemetryCSS', () => {
  it('generates hide rules for hidden sections', () => {
    const result = generateTelemetryCSS(
      [{key: 'tags', label: 'Tags'}],
      new Set(['tags']),
      false
    );
    expect(result).toContain('#tags, #tags + hr { display: none !important; }');
  });

  it('does not generate order rules when hasCustomOrder is false', () => {
    const result = generateTelemetryCSS([{key: 'tags', label: 'Tags'}], new Set(), false);
    expect(result).toBe('');
  });

  it('generates order rules for each section when hasCustomOrder is true', () => {
    const result = generateTelemetryCSS(
      [
        {key: 'breadcrumbs', label: 'Breadcrumbs'},
        {key: 'tags', label: 'Tags'},
      ],
      new Set(),
      true
    );
    expect(result).toContain('#breadcrumbs, #breadcrumbs + hr { order: 0; }');
    expect(result).toContain('#tags, #tags + hr { order: 1; }');
  });

  it('generates :has() rules for wrapper-aware ordering', () => {
    const result = generateTelemetryCSS(
      [{key: 'exception', label: 'Stack Trace'}],
      new Set(),
      true
    );
    expect(result).toContain(
      '[data-telemetry-container] > :has(#exception) { order: 0; }'
    );
  });

  it('combines hide and order rules', () => {
    const result = generateTelemetryCSS(
      [
        {key: 'breadcrumbs', label: 'Breadcrumbs'},
        {key: 'tags', label: 'Tags'},
      ],
      new Set(['tags']),
      true
    );
    expect(result).toContain('#tags, #tags + hr { display: none !important; }');
    expect(result).toContain('#tags, #tags + hr { order: 1; }');
    expect(result).toContain('#breadcrumbs, #breadcrumbs + hr { order: 0; }');
  });

  it('escapes keys with special characters', () => {
    const result = generateTelemetryCSS(
      [{key: 'user-feedback', label: 'User Feedback'}],
      new Set(['user-feedback']),
      false
    );
    expect(result).toContain('display: none !important');
  });
});

describe('TelemetryLayoutStyles', () => {
  beforeEach(() => {
    localStorageWrapper.clear();
  });

  function Wrapper({children}: {children: React.ReactNode}) {
    return <IssueDetailsContextProvider>{children}</IssueDetailsContextProvider>;
  }

  it('renders nothing when there are no preferences', () => {
    render(
      <Wrapper>
        <FoldSection sectionKey={SectionKey.TAGS} title="Tags">
          tags
        </FoldSection>
        <TelemetryLayoutStyles />
      </Wrapper>
    );
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });
});
