import {css} from '@emotion/react';
import type {UrlObject} from 'query-string';

import SentryAppLink from 'sentry/components/devtoolbar/components/sentryAppLink';
import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import {buttonCss} from 'sentry/components/devtoolbar/styles/typography';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import type {PlatformKey} from 'sentry/types/project';

import {panelCss, panelHeadingCss, panelSectionCss} from '../styles/panel';
import {resetDialogCss, resetFlexColumnCss, resetFlexRowCss} from '../styles/reset';

interface Props {
  children?: React.ReactNode;
  link?: UrlObject;
  noBorder?: boolean;
  showProjectBadge?: boolean;
  title?: string;
  titleRight?: React.ReactNode;
}

export default function PanelLayout({
  children,
  title,
  titleRight,
  showProjectBadge,
  noBorder,
  link,
}: Props) {
  const {projectId, projectSlug, projectPlatform} = useConfiguration();
  return (
    <dialog
      open
      css={[
        resetDialogCss,
        resetFlexColumnCss,
        panelCss,
        noBorder
          ? css`
              border-color: white;
            `
          : undefined,
      ]}
    >
      <span
        css={[
          panelHeadingCss,
          css`
            display: flex;
            align-items: center;
            gap: var(--space100);
          `,
          noBorder
            ? css`
                border-color: white;
              `
            : undefined,
        ]}
      >
        {showProjectBadge && (
          <ProjectBadge
            css={css`
              && img {
                box-shadow: none;
              }
            `}
            project={{
              slug: projectSlug,
              id: projectId,
              platform: projectPlatform as PlatformKey,
            }}
            avatarSize={16}
            hideName
            avatarProps={{hasTooltip: false}}
          />
        )}
        {title ? (
          <header
            css={[
              panelSectionCss,
              resetFlexRowCss,
              css`
                align-items: center;
                margin-right: var(--space100);
              `,
            ]}
          >
            {link ? (
              <SentryAppLink to={link}>
                <h1 css={[buttonCss]}>{title}</h1>
              </SentryAppLink>
            ) : (
              <h1 css={[buttonCss]}>{title}</h1>
            )}
            {titleRight}
          </header>
        ) : null}
      </span>
      <section css={resetFlexColumnCss} style={{contain: 'strict'}}>
        {children}
      </section>
    </dialog>
  );
}
