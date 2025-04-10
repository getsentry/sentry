import {type CSSProperties, Fragment, useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {mergeRefs} from '@react-aria/utils';

import ErrorBoundary from 'sentry/components/errorBoundary';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface FoldSectionStatelessProps {
  children: React.ReactNode;
  sectionKey: string;
  /**
   * Title of the section, always visible
   */
  title: React.ReactNode;
  /**
   * Actions associated with the section, only visible when open
   */
  actions?: React.ReactNode;
  className?: string;
  /**
   * If this is defined on the initial render, then the component will be
   * treated as a controlled component, meaning the parent component will need
   * to handle this component's state. You will likely need to use `onChange`
   * callback.
   */
  isCollapsed?: boolean;
  /**
   * Additional margin required to ensure that scrolling to `sectionKey` is correct.
   */
  navScrollMargin?: number;
  /**
   * Callback when the collapsed state changes
   */
  onChange?: (collapsed: boolean) => void;
  /**
   * Callback when scrolled to a collapsed section. If this is a controlled
   * component, you'll likely want to update state to have "is collapsed" =
   * false so that the section is expanded when you scroll to it.
   */
  onScrollToCollapsedSection?: (element?: HTMLElement) => void;
  /**
   * Disable the ability for the user to collapse the section
   */
  preventCollapse?: boolean;
  ref?: React.Ref<HTMLElement>;
  style?: CSSProperties;
}

interface FoldSectionProps extends FoldSectionStatelessProps {
  /**
   * Should this section be initially open, gets overridden by user preferences
   */
  initialCollapse?: boolean;
}

export function FoldSection({
  isCollapsed: isCollapsedProp,
  onChange,
  onScrollToCollapsedSection,
  initialCollapse = false,
  ...props
}: FoldSectionProps) {
  //
  const isControlled = useRef(isCollapsedProp !== undefined);
  const [isCollapsedState, setIsCollapsed] = useState(initialCollapse);

  const handleScrollToCollapsedSection = useCallback(
    (element: HTMLElement | undefined) => {
      if (isControlled.current) {
        onScrollToCollapsedSection?.(element);
      } else {
        setIsCollapsed(false);
      }
    },
    [onScrollToCollapsedSection, setIsCollapsed]
  );

  const handleChange = useCallback(
    (nextCollapsed: boolean) => {
      if (isControlled.current) {
        if (typeof onChange !== 'function') {
          // eslint-disable-next-line no-console
          console.warn(
            new Error(
              'Controlled prop `isCollapsed` used without on `onChange` prop. You likely need an `onChange` so parent component can handle the collapsed state.'
            )
          );
        }
        onChange?.(nextCollapsed);
      } else {
        setIsCollapsed(nextCollapsed);
      }
    },
    [onChange, setIsCollapsed]
  );

  return (
    <FoldSectionStateless
      {...props}
      isCollapsed={isCollapsedProp ?? isCollapsedState}
      onChange={handleChange}
      onScrollToCollapsedSection={handleScrollToCollapsedSection}
    />
  );
}

/**
 * This is a near-duplicate of the component in the
 * steamlined issues view, without localStorage syncing and
 * analytics.
 */
function FoldSectionStateless({
  ref,
  children,
  title,
  sectionKey,
  actions,
  className,
  isCollapsed,
  onChange,
  onScrollToCollapsedSection,
  navScrollMargin = 0,
  preventCollapse = false,
}: FoldSectionStatelessProps) {
  const hasAttemptedScroll = useRef(false);

  const scrollToSection = useCallback(
    (element: HTMLElement | null) => {
      if (!element || navScrollMargin || hasAttemptedScroll.current) {
        return;
      }
      // Prevent scrolling to element on rerenders
      hasAttemptedScroll.current = true;

      // scroll to element if it's the current section on page load
      if (window.location.hash) {
        const [, hash] = window.location.hash.split('#');
        if (hash === sectionKey) {
          if (isCollapsed) {
            onScrollToCollapsedSection?.(element);
          }

          // Delay scrollIntoView to allow for layout changes to take place
          setTimeout(() => element?.scrollIntoView(), 100);
        }
      }
    },
    [sectionKey, navScrollMargin, isCollapsed, onScrollToCollapsedSection]
  );

  // This controls disabling the InteractionStateLayer when hovering over action items. We don't
  // want selecting an action to appear as though it'll fold/unfold the section.
  const [isLayerEnabled, setIsLayerEnabled] = useState(true);

  const toggleCollapse = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault(); // Prevent browser summary/details behaviour
      window.getSelection()?.removeAllRanges(); // Prevent text selection on expand
      onChange?.(!isCollapsed);
    },
    [isCollapsed, onChange]
  );
  const labelPrefix = isCollapsed ? t('View') : t('Collapse');
  const labelSuffix = typeof title === 'string' ? title + t(' Section') : t('Section');

  return (
    <Fragment>
      <Section
        ref={mergeRefs(ref, scrollToSection)}
        id={sectionKey}
        scrollMargin={navScrollMargin ?? 0}
        role="region"
        className={className}
      >
        <SectionExpander
          preventCollapse={preventCollapse}
          onClick={preventCollapse ? e => e.preventDefault() : toggleCollapse}
          role="button"
          aria-label={`${labelPrefix} ${labelSuffix}`}
          aria-expanded={!isCollapsed}
        >
          <InteractionStateLayer
            hasSelectedBackground={false}
            hidden={preventCollapse ? preventCollapse : !isLayerEnabled}
          />
          <TitleWithActions preventCollapse={preventCollapse}>
            <TitleWrapper>{title}</TitleWrapper>
            {!isCollapsed && (
              <div
                onClick={e => e.stopPropagation()}
                onMouseEnter={() => setIsLayerEnabled(false)}
                onMouseLeave={() => setIsLayerEnabled(true)}
              >
                {actions}
              </div>
            )}
          </TitleWithActions>
          <IconWrapper preventCollapse={preventCollapse}>
            <IconChevron direction={isCollapsed ? 'down' : 'up'} size="xs" />
          </IconWrapper>
        </SectionExpander>
        {isCollapsed ? null : (
          <ErrorBoundary mini>
            <Content>{children}</Content>
          </ErrorBoundary>
        )}
      </Section>
      <SectionDivider />
    </Fragment>
  );
}

export const SectionDivider = styled('hr')`
  border-color: ${p => p.theme.translucentBorder};
  margin: ${space(1.5)} 0;
  &:last-child {
    display: none;
  }
`;

export const SidebarFoldSection = styled(FoldSection)`
  font-size: ${p => p.theme.fontSizeMedium};
  margin: -${space(1)};
`;

const Section = styled('section')<{scrollMargin: number}>`
  scroll-margin-top: calc(${space(1)} + ${p => p.scrollMargin ?? 0}px);
`;

const Content = styled('div')`
  padding: ${space(0.5)} ${space(0.75)};
`;

const SectionExpander = styled('div')<{preventCollapse: boolean}>`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  padding: ${space(0.5)} ${space(1.5)};
  margin: 0 -${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  cursor: ${p => (p.preventCollapse ? 'initial' : 'pointer')};
  position: relative;
`;

const TitleWrapper = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  user-select: none;
`;

const IconWrapper = styled('div')<{preventCollapse: boolean}>`
  color: ${p => p.theme.subText};
  line-height: 0;
  display: ${p => (p.preventCollapse ? 'none' : 'block')};
`;

const TitleWithActions = styled('div')<{preventCollapse: boolean}>`
  display: grid;
  grid-template-columns: 1fr auto;
  margin-right: ${p => (p.preventCollapse ? 0 : space(1))};
  align-items: center;
  /* Usually the actions are buttons, this height allows actions appearing after opening the
  details section to not expand the summary */
  min-height: 26px;
`;
