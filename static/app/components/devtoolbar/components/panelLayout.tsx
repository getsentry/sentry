import {css} from '@emotion/react';

import useConfiguration from 'sentry/components/devtoolbar/hooks/useConfiguration';
import {buttonCss} from 'sentry/components/devtoolbar/styles/typography';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import type {PlatformKey} from 'sentry/types/project';

import {panelCss, panelHeadingCss, panelSectionCss} from '../styles/panel';
import {resetDialogCss, resetFlexColumnCss, resetFlexRowCss} from '../styles/reset';

interface Props {
  children?: React.ReactNode;
  showProjectBadge?: boolean;
  title?: string;
  titleRight?: React.ReactNode;
}

export default function PanelLayout({
  children,
  title,
  titleRight,
  showProjectBadge,
}: Props) {
  const {projectId, projectSlug, projectPlatform} = useConfiguration();
  return (
    <dialog open css={[resetDialogCss, resetFlexColumnCss, panelCss]}>
      <span
        css={[
          {display: 'flex', alignItems: 'center', gap: 'var(--space100)'},
          panelHeadingCss,
        ]}
      >
        {showProjectBadge && (
          <ProjectBadge
            css={css({'&& img': {boxShadow: 'none'}})}
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
              {alignItems: 'center', marginRight: 'var(--space100)'},
            ]}
          >
            <h1 css={[buttonCss]}>{title}</h1>
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
