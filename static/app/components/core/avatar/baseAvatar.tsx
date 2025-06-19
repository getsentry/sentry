import type React from 'react';
import {useCallback, useState} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import * as qs from 'query-string';

import {Gravatar} from 'sentry/components/core/avatar/gravatar';
import {LetterAvatar} from 'sentry/components/core/avatar/letterAvatar';
import {Tooltip, type TooltipProps} from 'sentry/components/core/tooltip';
import type {Avatar as AvatarType} from 'sentry/types/core';

import {
  type BaseAvatarComponentProps,
  BaseAvatarComponentStyles,
} from './baseAvatarComponentStyles';

const DEFAULT_REMOTE_SIZE = 120;

export interface BaseAvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  backupAvatar?: React.ReactNode;
  gravatarId?: string;
  /**
   * Enable to display tooltips.
   */
  hasTooltip?: boolean;
  letterId?: string;
  ref?: React.Ref<HTMLSpanElement | SVGSVGElement | HTMLImageElement>;
  /**
   * Should avatar be round instead of a square
   */
  round?: boolean;
  size?: number;
  suggested?: boolean;
  title?: string;
  /**
   * The content for the tooltip. Requires hasTooltip to display
   */
  tooltip?: React.ReactNode;
  /**
   * Additional props for the tooltip
   */
  tooltipOptions?: Omit<TooltipProps, 'children' | 'title'>;
  /**
   * The type of avatar being rendered.
   */
  type?: AvatarType['avatarType'];
  /**
   * Full URL to the uploaded avatar's image.
   */
  uploadUrl?: string | null | undefined;
}

export function BaseAvatar({
  backupAvatar,
  className,
  gravatarId,
  letterId,
  size,
  style,
  suggested,
  title,
  tooltip,
  tooltipOptions,
  uploadUrl,
  hasTooltip = false,
  round = false,
  type = 'letter_avatar',
  ref,
  ...props
}: BaseAvatarProps) {
  const [hasError, setError] = useState<boolean | null>(null);

  const handleError = useCallback(() => setError(true), []);
  const handleLoad = useCallback(() => setError(false), []);

  const imageAvatar =
    type === 'upload' ? (
      <ImageAvatar
        ref={ref as React.Ref<HTMLImageElement>}
        src={uploadUrl ? `${uploadUrl}?${qs.stringify({s: DEFAULT_REMOTE_SIZE})}` : ''}
        round={round}
        suggested={suggested}
        onLoad={handleLoad}
        onError={handleError}
      />
    ) : type === 'gravatar' ? (
      <Gravatar
        ref={ref as React.Ref<HTMLImageElement>}
        gravatarId={gravatarId}
        remoteSize={DEFAULT_REMOTE_SIZE}
        round={round}
        suggested={suggested}
        onLoad={handleLoad}
        onError={handleError}
      />
    ) : (
      <LetterAvatar
        ref={ref as React.Ref<SVGSVGElement>}
        round={round}
        displayName={title === '[Filtered]' ? '?' : title}
        identifier={letterId}
        suggested={suggested}
      />
    );

  return (
    <Tooltip title={tooltip} disabled={!hasTooltip} {...tooltipOptions} skipWrapper>
      <AvatarContainer
        ref={ref as React.Ref<HTMLSpanElement>}
        data-test-id={`${type}-avatar`}
        className={classNames('avatar', className)}
        round={!!round}
        suggested={!!suggested}
        style={{...(size ? {height: size, width: size} : {}), ...style}}
        title={title}
        {...props}
      >
        {hasError
          ? (backupAvatar ?? (
              <LetterAvatar
                ref={ref as React.Ref<SVGSVGElement>}
                round={round}
                displayName={title === '[Filtered]' ? '?' : title}
                identifier={letterId}
                suggested={suggested}
              />
            ))
          : imageAvatar}
      </AvatarContainer>
    </Tooltip>
  );
}

// Note: Avatar will not always be a child of a flex layout, but this seems like a
// sensible default.
const AvatarContainer = styled('span')<{
  round: boolean;
  suggested: boolean;
}>`
  flex-shrink: 0;
  border-radius: ${p => (p.round ? '50%' : '3px')};
  border: ${p => (p.suggested ? `1px dashed ${p.theme.subText}` : 'none')};
  background-color: ${p => (p.suggested ? p.theme.background : 'none')};
`;

const ImageAvatar = styled('img')<BaseAvatarComponentProps>`
  ${BaseAvatarComponentStyles};
`;
