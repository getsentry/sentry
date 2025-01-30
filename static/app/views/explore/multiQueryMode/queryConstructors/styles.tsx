import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';

export const Section = styled('div')`
  margin-bottom: ${space(2)};
`;

export const SectionHeader = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: ${space(0.5)};
`;

export const SectionLabel = styled('h6')<{disabled?: boolean; underlined?: boolean}>`
  color: ${p => (p.disabled ? p.theme.gray300 : p.theme.gray500)};
  height: ${p => p.theme.form.md.height};
  min-height: ${p => p.theme.form.md.minHeight};
  font-size: ${p => p.theme.form.md.fontSize};
  margin: 0;
  ${p =>
    !defined(p.underlined) || p.underlined
      ? `text-decoration: underline dotted ${p.disabled ? p.theme.gray300 : p.theme.gray300}`
      : ''};
`;

export const SectionRow = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${space(0.5)};

  :not(:last-child) {
    margin-bottom: ${space(0.5)};
  }
`;

// This css is copied over from PageFilterBar. Not using that component to prevent
// and uninteded changes since that is primarily used for the page filters.
export const CompactSelectBar = styled('div')<{condensed?: boolean}>`
  display: flex;
  position: relative;
  border-radius: ${p => p.theme.borderRadius};
  height: ${p => p.theme.form.md.height}px;
  ${p =>
    p.condensed &&
    `
    max-width: 100%;
    width: max-content;
  `}

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    pointer-events: none;
    box-shadow: inset 0 0 0 1px ${p => p.theme.border};
    border-radius: ${p => p.theme.borderRadius};
  }

  & [role='button'] {
    z-index: 0;
  }

  & button[aria-haspopup] {
    height: 100%;
    width: 100%;
    min-height: auto;
    border-color: transparent;
    box-shadow: none;
    z-index: 0;
  }

  /* Less inner padding between buttons */
  & > div:not(:first-child) > button[aria-haspopup] {
    padding-left: ${space(1.5)};
  }
  & > div:not(:last-child) > button[aria-haspopup] {
    padding-right: ${space(1.5)};
  }

  & button[aria-haspopup]:focus-visible {
    border-color: ${p => p.theme.focusBorder};
    box-shadow: 0 0 0 1px ${p => p.theme.focusBorder};
    z-index: 1;
  }

  & > * {
    min-width: 0;
    flex-grow: 1;
    flex-shrink: 1;
    flex-basis: max-content;

    /* Prevent project filter from shrinking (it has in-built max character count)
    except in mobile */
    &:first-child {
      flex-shrink: 0;
      @media only screen and (max-width: ${p => p.theme.breakpoints.small}) {
        flex-shrink: 1;
      }
    }

    /* Prevent date filter from shrinking below 6.5rem */
    &:last-child {
      min-width: 4rem;
    }
  }

  & > *:not(:first-child)::after {
    content: '';
    position: absolute;
    height: 60%;
    width: 1px;
    background-color: ${p => p.theme.innerBorder};
    left: 0;
    top: 50%;
    transform: translateY(-50%);
  }

  & > *:hover::after,
  & > *[data-is-open='true']::after,
  & > *:hover + *:not(:first-child)::after,
  & > *[data-is-open='true'] + *:not(:first-child)::after {
    display: none;
  }
`;
