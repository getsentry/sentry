import styled from '@emotion/styled';

import {inlineCodeStyles} from '@sentry/scraps/code';

type ProsePropsWithChildren<T extends keyof HTMLElementTagNameMap = 'div'> = {
  as?: T;
  children?: React.ReactNode;
  ref?: React.Ref<HTMLElementTagNameMap[T] | null>;
} & React.HTMLAttributes<HTMLElementTagNameMap[T]>;

export const Prose = styled(
  <T extends keyof HTMLElementTagNameMap = 'div'>({
    children,
    as = 'article' as T,
    ...rest
  }: ProsePropsWithChildren<T>) => {
    const Component = as as React.ElementType;
    return <Component {...(rest as any)}>{children}</Component>;
  }
)`
  /* stylelint-disable no-descending-specificity */
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p,
  /* Exclude ol/ul elements inside interactive selectors/menus */
  ul:not([role='listbox'], [role='grid'], [role='menu']),
  ol:not([role='listbox'], [role='grid'], [role='menu']),
  table,
  dl,
  blockquote,
  form,
  pre,
  .auto-select-text,
  .section,
  [class^='highlight-'] {
    margin-bottom: ${p => p.theme.space['2xl']};

    &:last-child {
      margin-bottom: 0;
    }
  }
  code:not(pre code) {
    ${p => inlineCodeStyles(p.theme)};
  }
  /* stylelint-enable */
`;
