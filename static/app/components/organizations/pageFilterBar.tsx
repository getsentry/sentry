import styled from '@emotion/styled';

const PageFilterBar = styled('div')`
  display: flex;
  position: relative;
  border-radius: ${p => p.theme.borderRadius};
  height: ${p => p.theme.form.default.height}px;

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

  & button[aria-haspopup='listbox'] {
    height: 100%;
    min-height: auto;
    border-color: transparent !important;
    box-shadow: none;
    z-index: 0;
  }

  & > * {
    min-width: 6rem;
    flex-grow: 1;
    flex-shrink: 1;
    flex-basis: max-content;
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
  & > *:focus-within::after,
  & > *:hover + *:not(:first-child)::after,
  & > *:focus-within + *:not(:first-child)::after {
    display: none;
  }
`;

export default PageFilterBar;
